import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { reportError } from '@/lib/infra/telemetry/monitoring/report-error';
import { RateLimitPolicyMisuseError, unavailableReason } from '../consume';
import { recordRateLimitEvent } from '../events';
import { consumeDegraded, type KeyContext, prefilter } from '../fail-mode';
import { hashRateLimitKey, RateLimitKeyError } from '../key-hash';
import { logThrottled } from '../log-throttle';
import { getRateLimitPolicy, type RateLimitPolicyName } from '../policies';
import { readLimiterDbTimeoutMs } from '../sql-consumer';
import type {
  RateLimitKey,
  RateLimitKeyKind,
  RateLimitPolicy,
  RateLimitResult,
} from '../types';
import {
  createSqlLeaseStore,
  type LeaseConsumeRow,
  type LeaseStore,
} from './lease-sql';
import { createLease, type RateLimitLease, toMicroUsd } from './release';
import {
  AI_SPEND_DAILY_LIMIT_USD,
  type AiSpendKind,
  aiSpendEstimatesUsd,
} from './spend-limits';

export { type RateLimitLease, toMicroUsd } from './release';

/** The spend half of a lease, under the name the AI layer knows it by. */
export type SpendLease = RateLimitLease;

interface LeaseSeams {
  store?: LeaseStore;
  now?: Date;
  recordEvent?: typeof recordRateLimitEvent;
  /** Monotonic clock for the per-instance burst bucket. */
  nowMs?: () => number;
}

export interface AcquireRateLimitOptions extends LeaseSeams {
  /**
   * `false` takes the slot without counting any window: a request that must
   * run one at a time but is not one of the day's N (a clarify answer, an App
   * Review account).
   */
  countWindows?: boolean;
}

export interface AcquireSpendLeaseOptions extends LeaseSeams {
  /**
   * `false` books the cost without checking the brake — for the App Review
   * accounts, which must never be refused while a build is in review. Their
   * spend still counts toward everyone else's limit.
   */
  enforce?: boolean;
  /**
   * A per-key policy checked in the SAME call as the brake: its windows and
   * slot, then the reservation, all or nothing.
   */
  rateLimit?: {
    policy: RateLimitPolicyName;
    key: RateLimitKey;
    countWindows?: boolean;
  };
}

/**
 * A reservation is on the path of every AI request and waits on a pool that
 * the request's own matching queries also use. 400 ms (the counter default)
 * would turn ordinary pool contention into refused meals; an analysis runs
 * for tens of seconds, so two seconds of waiting costs nothing visible.
 */
const SPEND_DB_TIMEOUT_MS = 2000;

const BRAKE_KEY = { keyKind: 'global', keyHash: 'ai-spend' } as const;

let cachedStore: LeaseStore | undefined;
let alertedDay: string | undefined;

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

/** The policy's key, hashed — or the reason there is none. */
interface ResolvedKey {
  policy: RateLimitPolicy;
  keyKind: RateLimitKeyKind;
  keyHash: string;
  context: KeyContext;
}

function resolveKey(
  policyName: RateLimitPolicyName,
  key: RateLimitKey,
  seams: LeaseSeams,
  recordEvent: typeof recordRateLimitEvent
): ResolvedKey {
  const policy = getRateLimitPolicy(policyName);
  let keyHash: string | undefined;
  if (policy.keyKinds.includes(key.kind)) {
    try {
      keyHash = hashRateLimitKey(key);
    } catch (error) {
      if (!(error instanceof RateLimitKeyError)) throw error;
    }
  }
  // Every lease policy is keyed on a user id the caller already
  // authenticated, so a missing key is a code bug, never a request to admit.
  if (!keyHash) {
    throw new RateLimitPolicyMisuseError(
      policy.route,
      `[rate-limit] ${policy.route} resolved no usable key (accepts ${policy.keyKinds.join(', ')})`
    );
  }
  return {
    policy,
    keyKind: key.kind,
    keyHash,
    context: {
      policy,
      keyKind: key.kind,
      keyHash,
      bucketKey: `${policy.route}:${key.kind}:${keyHash}`,
      recordEvent,
      nowMs: seams.nowMs,
    },
  };
}

function refusedByBucket(result: RateLimitResult): never {
  throw Errors.rateLimited(
    undefined,
    result.allowed ? 1 : result.retryAfterSeconds
  );
}

interface LeaseRequest extends LeaseSeams {
  rateLimit?: {
    policy: RateLimitPolicyName;
    key: RateLimitKey;
    countWindows?: boolean;
  };
  spend?: { kind: AiSpendKind; enforce: boolean };
}

/**
 * The one way in: a key's windows and slot and/or a spend reservation, in a
 * single `rate_limit_consume` call.
 *
 * Throws `RateLimitedError` (429) on a refusal, with `reason` set for the
 * limits a caller words itself (`ai_paused`, `daily_limit`, `in_flight`), and
 * `RateLimitUnavailableError` (503) when the database cannot answer for a
 * fail-closed policy or a spend reservation — admitting with the brake
 * unreadable would be spending with no ceiling. A `degraded` policy without
 * spend falls back to the per-instance bucket and holds no slot.
 */
async function acquireLease(request: LeaseRequest): Promise<RateLimitLease> {
  const now = request.now ?? new Date();
  const store = request.store ?? getStore();
  const recordEvent = request.recordEvent ?? recordRateLimitEvent;
  const resolved = request.rateLimit
    ? resolveKey(
        request.rateLimit.policy,
        request.rateLimit.key,
        request,
        recordEvent
      )
    : undefined;
  const countWindows = request.rateLimit?.countWindows !== false;
  const spend = request.spend;
  const enforceSpend = spend?.enforce === true;
  const route = resolved?.policy.route ?? `ai:spend:${spend?.kind}`;
  const slot = resolved?.policy.concurrency ?? null;

  if (resolved && countWindows) {
    const flooded = prefilter(resolved.context);
    if (flooded) refusedByBucket(flooded);
  }

  const estimateMicroUsd = spend
    ? toMicroUsd(aiSpendEstimatesUsd[spend.kind])
    : 0;
  const reservedMicroUsd = enforceSpend ? estimateMicroUsd : 0;
  const lease = (
    heldSlot: { keyHash: string; expiresAt: string } | null,
    spendDay: string
  ) =>
    createLease({
      store,
      route,
      keyKind: resolved?.keyKind ?? 'global',
      slot: heldSlot,
      spendDay,
      reservedMicroUsd,
      estimateMicroUsd,
      tracksSpend: spend != null,
      timeoutMs: spend ? SPEND_DB_TIMEOUT_MS : readLimiterDbTimeoutMs(),
    });

  // Nothing to ask the database: an App Review spend with no key to check.
  if (!resolved && !enforceSpend) return lease(null, utcDay(now));

  let row: LeaseConsumeRow;
  try {
    row = await store.consume({
      keyKind: resolved?.keyKind ?? 'global',
      keyHash: resolved?.keyHash ?? null,
      route,
      limits: resolved && countWindows ? resolved.policy.limits : null,
      slot: slot && { limit: slot.limit, ttlSeconds: slot.ttlSeconds },
      spendMicroUsd: enforceSpend ? reservedMicroUsd : null,
      spendLimitMicroUsd: enforceSpend
        ? toMicroUsd(AI_SPEND_DAILY_LIMIT_USD)
        : null,
      now: request.now,
      timeoutMs: spend ? SPEND_DB_TIMEOUT_MS : readLimiterDbTimeoutMs(),
    });
  } catch (error) {
    logThrottled(
      `lease:${route}`,
      `[rate-limit] lease failed for ${route}`,
      error
    );
    recordEvent({
      route,
      reason: unavailableReason(error),
      source: 'db',
      ...(resolved
        ? { keyKind: resolved.keyKind, keyHash: resolved.keyHash }
        : BRAKE_KEY),
      retryAfterSeconds: null,
    });
    if (resolved && !spend && resolved.policy.failMode === 'degraded') {
      const fallback = consumeDegraded(resolved.context);
      if (!fallback.allowed) refusedByBucket(fallback);
      return lease(null, utcDay(now));
    }
    throw error instanceof RateLimitUnavailableError
      ? error
      : Errors.rateLimiterUnavailable(error, 'error');
  }

  if (!row.allowed) {
    const retryAfterSeconds = Math.max(1, row.retry_after_seconds ?? 1);

    if (row.reason === 'budget') {
      recordEvent({
        route: `ai:spend:${spend?.kind}`,
        reason: 'budget',
        source: 'db',
        ...BRAKE_KEY,
        retryAfterSeconds,
      });
      alertBrakeTripped(utcDay(now));
      throw Errors.aiPaused(retryAfterSeconds);
    }

    const reason =
      row.reason === 'concurrent' ||
      row.reason === 'hour' ||
      row.reason === 'day'
        ? row.reason
        : 'minute';
    // A held slot frees when its request ends, long before its lifetime.
    const retry =
      reason === 'concurrent' && slot
        ? slot.retryAfterSeconds
        : retryAfterSeconds;
    recordEvent({
      route,
      reason,
      source: 'db',
      keyKind: resolved?.keyKind ?? 'global',
      keyHash: resolved?.keyHash ?? 'none',
      retryAfterSeconds: retry,
    });
    throw Errors.rateLimited(
      undefined,
      retry,
      reason === 'concurrent'
        ? 'in_flight'
        : reason === 'day'
          ? 'daily_limit'
          : undefined
    );
  }

  return lease(
    resolved && row.slot_expires_at
      ? { keyHash: resolved.keyHash, expiresAt: row.slot_expires_at }
      : null,
    row.spend_day ?? utcDay(now)
  );
}

/**
 * Take `policy`'s windows and one-at-a-time slot for `key`. The lease's
 * `release` frees the slot; call it on every exit (`withRateLimit` does).
 */
export function acquireRateLimit(
  policy: RateLimitPolicyName,
  key: RateLimitKey,
  options: AcquireRateLimitOptions = {}
): Promise<RateLimitLease> {
  return acquireLease({
    ...options,
    rateLimit: { policy, key, countWindows: options.countWindows },
  });
}

/** `acquireRateLimit`, run `work`, release on every exit. */
export async function withRateLimit<T>(
  policy: RateLimitPolicyName,
  key: RateLimitKey,
  work: () => Promise<T>,
  options: AcquireRateLimitOptions = {}
): Promise<T> {
  const lease = await acquireRateLimit(policy, key, options);
  try {
    return await work();
  } finally {
    await lease.release();
  }
}

/**
 * Reserve `kind`'s estimate against today's AI spend, and with `rateLimit`
 * take that policy's windows and slot in the same call.
 *
 * Throws `Errors.aiPaused` (429 `RATE_LIMITED`, `Retry-After` to the next UTC
 * midnight) once the brake has tripped.
 */
export function acquireSpendLease(
  kind: AiSpendKind,
  options: AcquireSpendLeaseOptions = {}
): Promise<SpendLease> {
  return acquireLease({
    ...options,
    spend: { kind, enforce: options.enforce !== false },
  });
}
