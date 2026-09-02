import type { MaybeRow, PendingQuery, RowList } from 'postgres';
import { Errors } from '@/lib/core/errors/catalog';
import { db as appDb } from '@/lib/infra/db/client';
import type {
  RateLimitConsumeInput,
  RateLimitConsumeRow,
  RateLimitConsumer,
} from './types';

const DEFAULT_LIMITER_DB_TIMEOUT_MS = 400;

/**
 * How long a consume may wait on Postgres before the limiter gives up.
 *
 * `DB_POOL_MAX` defaults to 2 per instance, so a consume does not merely wait
 * on the network — it queues behind whatever else that isolate is running.
 * postgres.js `connect_timeout` bounds establishing a connection, not waiting
 * for one, so without this a limiter check on a saturated pool could outlast
 * the request it is guarding.
 */
export function readLimiterDbTimeoutMs() {
  const parsed = Number(process.env.LIMITER_DB_TIMEOUT_MS);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LIMITER_DB_TIMEOUT_MS;
}

/**
 * Race a query against the deadline and CANCEL it when the deadline wins.
 *
 * A plain `Promise.race` only stops *waiting*; the query itself stays in
 * postgres.js's queue and eventually takes one of the two pooled connections
 * anyway — after the request it was guarding already got its 503. Worse, it
 * commits: the abandoned consume increments a counter for a request that was
 * never admitted, so a saturated pool quietly charges everyone twice.
 *
 * `PendingQuery.cancel()` is what makes the abort real. In postgres.js 3.4.9 a
 * query that has not yet been assigned a connection is removed from the queue
 * and rejected immediately with SQLSTATE 57014; one already in flight gets a
 * CancelRequest on a SEPARATE socket, so cancellation works even when the pool
 * is exactly the resource that is exhausted.
 *
 * That second socket is also why the cancel must be treated as BEST EFFORT.
 * `cancel()` returns a promise and dials a fresh connection; when the server
 * has gone away underneath us (restart, crash recovery, reset peer) it rejects
 * — and an unhandled rejection from a limiter timeout would take the process
 * down over a request we had already decided to refuse. Swallowing it changes
 * nothing we owe the caller: the deadline expired either way, and `reject`
 * below is still what the caller sees.
 */
async function withDeadline<TRow extends readonly MaybeRow[]>(
  pending: PendingQuery<TRow>,
  timeoutMs: number
): Promise<RowList<TRow>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          // Cancel FIRST, then reject: the order is what guarantees the caller
          // never returns before the abort has been issued. Both failure
          // shapes are absorbed — a synchronous throw and a rejected promise
          // — because a cancel that cannot be delivered must not escalate a
          // 503 into a crash.
          try {
            void Promise.resolve(pending.cancel()).catch(() => undefined);
          } catch {
            // Nothing to do: the query is unreachable, the deadline stands.
          }
          reject(
            Errors.rateLimiterUnavailable(
              new Error(`rate limiter DB deadline of ${timeoutMs}ms expired`),
              'timeout'
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * `$1..$7`, one per argument, with an explicit `::cast` on each.
 *
 * The client runs with `prepare: false` (PgBouncer transaction mode), so
 * Postgres resolves the overload from the literal text of the statement — and
 * `NULL` with no cast is ambiguous the moment a function has more than one
 * signature. The casts also pin `p_now` as `timestamptz` rather than letting an
 * untyped literal fall to `text`.
 */
const CONSUME_SQL = `
  select
    allowed,
    reason,
    retry_after_seconds,
    remaining_minute,
    remaining_hour,
    remaining_day
  from public.rate_limit_consume(
    $1::text,
    $2::text,
    $3::text,
    $4::integer,
    $5::integer,
    $6::integer,
    $7::timestamptz
  )
`;

/** Just the handle we need — the seam a test can stand in for. */
type RateLimitDb = Pick<typeof appDb, '$client'>;

/**
 * The production consumer: one call to `public.rate_limit_consume`.
 *
 * No `db.transaction()`. The function is a single statement's worth of work
 * and is atomic on its own; wrapping it would hold a pooled connection across
 * two round trips for no added guarantee, on a pool of two.
 *
 * It goes through the raw postgres.js handle (`db.$client.unsafe`) rather than
 * `db.execute`, because `unsafe` is exactly what drizzle calls internally AND
 * it hands back a `PendingQuery` — the only thing in the stack that owns a
 * `.cancel()`. Drizzle's `execute` returns a bare promise, which is
 * unabortable, and an unabortable query is what turns the deadline into a lie
 * (see `withDeadline`).
 *
 * `p_now` is sent as an ISO-8601 STRING, not a `Date`. Attaching an explicit
 * type oid to a Date makes postgres.js throw
 * `ERR_INVALID_ARG_TYPE: … Received an instance of Date` at bind time — caught
 * by the DB test, and invisible in production only because the live path
 * always leaves `now` undefined.
 */
export function createSqlRateLimitConsumer(
  database: RateLimitDb = appDb
): RateLimitConsumer {
  return {
    async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeRow> {
      const pending = database.$client.unsafe<RateLimitConsumeRow[]>(
        CONSUME_SQL,
        [
          input.keyKind,
          input.keyHash,
          input.route,
          input.limits.perMinute ?? null,
          input.limits.perHour ?? null,
          input.limits.perDay ?? null,
          input.now?.toISOString() ?? null,
        ]
      );

      const rows = await withDeadline(pending, readLimiterDbTimeoutMs());
      const row = rows[0];

      if (!row) {
        // The function always returns exactly one row; zero means the call did
        // not run what we think it ran (wrong search_path, stale signature).
        throw Errors.rateLimiterUnavailable(
          new Error('rate_limit_consume returned no rows'),
          'error'
        );
      }

      return row;
    },
  };
}
