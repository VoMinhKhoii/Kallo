import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { reportError } from '@/lib/infra/telemetry/monitoring/report-error';
import { unavailableReason } from '../consume';
import { recordRateLimitEvent } from '../events';
import { logThrottled } from '../log-throttle';
import { createSqlLeaseStore, type LeaseStore } from './lease-sql';
import {
  AI_SPEND_DAILY_LIMIT_USD,
  type AiSpendKind,
  aiSpendEstimatesUsd,
} from './spend-limits';

/**
 * A reservation against the app-wide AI spend brake, held while one unit of
 * AI work runs.
 *
 * `rate_limit_consume` books the estimate before the work starts (refusing
 * once the day's spend would cross the limit), and `settle` swaps it for what
 * the work really cost. Spend is counted in micro-USD, so a $0.0048 meal is
 * 4800, not a rounding error.
 */
export interface SpendLease {
  /**
   * Swap the estimate for the real cost. `null` (a cost we could not price)
   * keeps the estimate counted. Runs once; never throws — a failed settle
   * leaves the estimate in place, which is the safe side.
   */
  settle(actualCostUsd: number | null): Promise<void>;
  /** A cost that arrived after `settle` (a call that outlived its request). */
  addLate(costUsd: number): void;
}

export interface AcquireSpendLeaseOptions {
  /**
   * `false` books the cost without checking the brake — for the App Review
   * accounts, which must never be refused while a build is in review. Their
   * spend still counts toward everyone else's limit.
   */
  enforce?: boolean;
  /** Test seams. */
  store?: LeaseStore;
  now?: Date;
  recordEvent?: typeof recordRateLimitEvent;
}

const BRAKE_KEY = { keyKind: 'global', keyHash: 'ai-spend' } as const;

let cachedStore: LeaseStore | undefined;
let alertedDay: string | undefined;

export function toMicroUsd(usd: number): number {
  return Math.round(usd * 1_000_000);
}

function getStore(): LeaseStore {
  cachedStore ??= createSqlLeaseStore();
  return cachedStore;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Drops the cached store and the once-a-day alert latch. Tests only. */
export function resetSpendLeaseForTests() {
  cachedStore = undefined;
  alertedDay = undefined;
}

/**
 * Tell the owner, once per UTC day per instance. Each day gets its own
 * Sentry fingerprint, so every trip opens a NEW issue and fires the project's
 * new-issue alert, instead of folding into last month's resolved one.
 */
function alertBrakeTripped(day: string) {
  if (alertedDay === day) return;
  alertedDay = day;

  const error = new Error(
    `AI spend brake tripped: $${AI_SPEND_DAILY_LIMIT_USD} reached on ${day} (UTC). Every AI call is refused until the next UTC day.`
  );
  error.name = 'AiSpendBrakeTripped';
  console.error(`[ai-spend-brake] ${error.message}`);
  reportError(error, '[ai-spend-brake]', {
    fingerprint: ['ai-spend-brake', day],
  });
}

function createLease(args: {
  store: LeaseStore;
  route: string;
  spendDay: string;
  reservedMicroUsd: number;
  /** What an unknown cost is booked at: the kind's estimate. */
  estimateMicroUsd: number;
}): SpendLease {
  let settled: Promise<void> | undefined;

  const send = (deltaMicroUsd: number) =>
    deltaMicroUsd === 0
      ? Promise.resolve()
      : args.store
          .settle({
            route: args.route,
            spendDay: args.spendDay,
            deltaMicroUsd,
          })
          .catch((error) => {
            logThrottled(
              `settle:${args.route}`,
              `[ai-spend-brake] settle failed for ${args.route}`,
              error
            );
          });

  return {
    settle(actualCostUsd) {
      // An unknown cost books the estimate — already reserved on an enforced
      // lease (delta 0), booked here on an App Review one, which reserved
      // nothing.
      settled ??= send(
        (actualCostUsd == null
          ? args.estimateMicroUsd
          : toMicroUsd(actualCostUsd)) - args.reservedMicroUsd
      );
      return settled;
    },
    addLate(costUsd) {
      void send(toMicroUsd(costUsd));
    },
  };
}

/**
 * Reserve `kind`'s estimate against today's AI spend.
 *
 * Throws `Errors.aiPaused` (429 `RATE_LIMITED`, `Retry-After` to the next UTC
 * midnight) once the brake has tripped, and `RateLimitUnavailableError` (503)
 * when the database cannot answer: admitting with the brake unreadable would
 * be spending with no ceiling.
 */
export async function acquireSpendLease(
  kind: AiSpendKind,
  options: AcquireSpendLeaseOptions = {}
): Promise<SpendLease> {
  const route = `ai:spend:${kind}`;
  const now = options.now ?? new Date();
  const store = options.store ?? getStore();
  const recordEvent = options.recordEvent ?? recordRateLimitEvent;

  const estimateMicroUsd = toMicroUsd(aiSpendEstimatesUsd[kind]);
  if (options.enforce === false) {
    return createLease({
      store,
      route,
      spendDay: utcDay(now),
      reservedMicroUsd: 0,
      estimateMicroUsd,
    });
  }

  const reservedMicroUsd = estimateMicroUsd;
  let row: Awaited<ReturnType<LeaseStore['reserve']>>;

  try {
    row = await store.reserve({
      route,
      spendMicroUsd: reservedMicroUsd,
      spendLimitMicroUsd: toMicroUsd(AI_SPEND_DAILY_LIMIT_USD),
      now: options.now,
    });
  } catch (error) {
    logThrottled(
      `reserve:${route}`,
      `[ai-spend-brake] reserve failed for ${route}`,
      error
    );
    recordEvent({
      route,
      reason: unavailableReason(error),
      source: 'db',
      ...BRAKE_KEY,
      retryAfterSeconds: null,
    });
    throw error instanceof RateLimitUnavailableError
      ? error
      : Errors.rateLimiterUnavailable(error, 'error');
  }

  if (!row.allowed) {
    const retryAfterSeconds = Math.max(1, row.retry_after_seconds ?? 1);
    recordEvent({
      route,
      reason: 'budget',
      source: 'db',
      ...BRAKE_KEY,
      retryAfterSeconds,
    });
    alertBrakeTripped(utcDay(now));
    throw Errors.aiPaused(retryAfterSeconds);
  }

  return createLease({
    store,
    route,
    spendDay: row.spend_day ?? utcDay(now),
    reservedMicroUsd,
    estimateMicroUsd,
  });
}
