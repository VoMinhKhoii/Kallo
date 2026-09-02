import { db as appDb } from '@/lib/infra/db/client';
import { rateLimitEvents } from '@/lib/infra/db/schema';
import { logThrottled } from './log-throttle';
import type {
  RateLimitEventReason,
  RateLimitKeyKind,
  RateLimitSource,
} from './types';

export interface RateLimitEventInput {
  route: string;
  reason: RateLimitEventReason;
  source: RateLimitSource;
  keyKind: RateLimitKeyKind;
  keyHash: string;
  retryAfterSeconds?: number | null;
}

type EventRow = typeof rateLimitEvents.$inferInsert;

/**
 * The narrow slice of the drizzle handle this module uses.
 *
 * Structural rather than `Pick<typeof appDb, 'insert'>` so a test can supply a
 * two-line fake: the real `insert` returns a builder with a dozen internal
 * fields, and a seam that only the production object can satisfy is not a seam.
 */
export interface EventDb {
  insert(table: typeof rateLimitEvents): {
    values(rows: EventRow[]): PromiseLike<unknown>;
  };
}

interface AggregatedEvent {
  route: string;
  keyKind: RateLimitKeyKind;
  keyHash: string;
  reason: RateLimitEventReason;
  source: RateLimitSource;
  hits: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  retryAfterSeconds: number | null;
}

/**
 * Distinct (route, key, reason, source) tuples held in memory before a flush.
 *
 * A flood is a small number of keys repeated enormously often, so 2000 is far
 * more than any real attack needs; past it the shape of the traffic is already
 * recorded and the only thing more entries buy is memory pressure on the
 * instance that is under attack.
 */
const MAX_ENTRIES = 2000;
const FLUSH_INTERVAL_MS = 5000;
/** One INSERT stays one statement: 200 rows is a comfortable single round trip. */
const MAX_ROWS_PER_FLUSH = 200;

const pending = new Map<string, AggregatedEvent>();
let droppedSinceLastFlush = 0;
let lastFlushAtMs = 0;
let flushTimer: ReturnType<typeof setInterval> | undefined;

function aggregateKey(input: RateLimitEventInput) {
  return `${input.route}|${input.keyKind}|${input.keyHash}|${input.reason}|${input.source}`;
}

/**
 * Start the periodic flush, lazily and UNREF'd.
 *
 * Lazy so importing this module never starts a timer (a CLI script or a test
 * that only touches policies must not acquire one). Unref'd so a pending flush
 * can never be the reason a process refuses to exit — telemetry is the least
 * important thing running.
 */
function ensureFlushTimer(database: EventDb) {
  if (flushTimer) return;

  // Start the coalescing window HERE, not at module load: otherwise the very
  // first event of a burst is older than the interval and flushes alone.
  lastFlushAtMs = Date.now();
  flushTimer = setInterval(() => {
    flushRateLimitEvents(database);
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
}

/**
 * Write at most `MAX_ROWS_PER_FLUSH` aggregated rows as ONE insert.
 *
 * Fire-and-forget, deliberately: this runs on the 429 path, and a telemetry
 * write that could fail (or merely be slow) would turn "you are over quota"
 * into "the server errored". Anything over the batch size stays in the map and
 * goes out on the next flush, so a burst is spread across statements instead
 * of being turned into one enormous one.
 */
function flushRateLimitEvents(database: EventDb) {
  lastFlushAtMs = Date.now();

  const dropped = droppedSinceLastFlush;
  droppedSinceLastFlush = 0;

  if (dropped > 0) {
    logThrottled(
      'events:dropped',
      `[rate-limit] telemetry buffer full — dropped ${dropped} distinct event keys`
    );
  }

  if (pending.size === 0) return;

  const batch: AggregatedEvent[] = [];

  for (const [key, event] of pending) {
    if (batch.length >= MAX_ROWS_PER_FLUSH) break;
    batch.push(event);
    pending.delete(key);
  }

  try {
    void database
      .insert(rateLimitEvents)
      .values(
        batch.map((event) => ({
          route: event.route,
          reason: event.reason,
          source: event.source,
          keyKind: event.keyKind,
          keyHash: event.keyHash,
          retryAfterSeconds: event.retryAfterSeconds,
          hits: event.hits,
          createdAt: event.firstSeenAt,
          lastSeenAt: event.lastSeenAt,
        }))
      )
      .then(
        () => undefined,
        (error: unknown) => {
          logThrottled('events', '[rate-limit] failed to record events', error);
        }
      );
  } catch (error) {
    // The db handle is a lazy Proxy: with no DATABASE_URL, merely reaching for
    // `.insert` throws SYNCHRONOUSLY. Telemetry must never be able to convert
    // a 429 into a 500.
    logThrottled('events', '[rate-limit] failed to record events', error);
  }
}

/**
 * Count one block against the limiter's audit trail.
 *
 * COALESCED, not one INSERT per block. The naive version fired a write into a
 * LOGGED, indexed table for every blocked request — so the harder the flood,
 * the more database work the flood breaker itself generated, on the same
 * two-connection pool it was supposed to protect. Here a flood of N requests
 * on one key costs one row with `hits = N` and at most one statement per five
 * seconds.
 *
 * Only hashed keys are written, so this table can be read for triage without
 * exposing who was throttled. Sample queries: docs/RATE_LIMITING.md.
 */
export function recordRateLimitEvent(
  input: RateLimitEventInput,
  database: EventDb = appDb
): void {
  const now = new Date();
  const key = aggregateKey(input);
  const existing = pending.get(key);

  if (existing) {
    existing.hits += 1;
    existing.lastSeenAt = now;
    // Freshest Retry-After wins: it describes the window the client is in now.
    existing.retryAfterSeconds = input.retryAfterSeconds ?? null;
  } else if (pending.size >= MAX_ENTRIES) {
    // Deliberately allocates nothing: the whole point of the cap is that an
    // attacker minting fresh keys cannot make us grow.
    droppedSinceLastFlush += 1;
  } else {
    pending.set(key, {
      route: input.route,
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      reason: input.reason,
      source: input.source,
      hits: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      retryAfterSeconds: input.retryAfterSeconds ?? null,
    });
  }

  ensureFlushTimer(database);

  // Flush on write too, so a burst that stops does not sit unwritten until the
  // next tick — the timer is the floor on latency, not the only trigger.
  if (now.getTime() - lastFlushAtMs >= FLUSH_INTERVAL_MS) {
    flushRateLimitEvents(database);
  }
}

/** Force a flush without waiting for the interval. Tests only. */
export function flushRateLimitEventsForTests(database: EventDb = appDb) {
  flushRateLimitEvents(database);
}

/** Drop every buffered event and stop the timer. Tests only. */
export function resetRateLimitEventsForTests() {
  pending.clear();
  droppedSinceLastFlush = 0;
  lastFlushAtMs = 0;
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = undefined;
}
