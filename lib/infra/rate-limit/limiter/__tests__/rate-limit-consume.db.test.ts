/**
 * `public.rate_limit_consume` against a REAL Postgres.
 *
 * The plpgsql is the definition of the limiter; the in-memory reference model
 * only mirrors it. Everything that can only be wrong in the database —
 * three-argument `date_trunc` ignoring the session TimeZone, the row lock that
 * makes a blocked request consume nothing, `ON CONFLICT ... WHERE` under real
 * concurrency, the grant/deny boundary as the roles that actually connect,
 * and whether a timed-out consume is genuinely CANCELLED rather than merely
 * abandoned — is pinned here, and only here.
 *
 * SKIPS ONLY WITHOUT `DATABASE_URL`. With one set, a connection failure or a
 * missing function is a FAILURE, not a skip: the previous version swallowed
 * every error and reported green against a wrong tenant, a stale schema, or a
 * database that was never reachable — i.e. exactly when this suite is the only
 * thing that would have caught the problem. CI additionally asserts the
 * function exists BEFORE vitest runs, so a broken gate cannot look like a
 * passing one.
 *
 * CI runs it in the `migrations` job against local Supabase THROUGH THE
 * TRANSACTION POOLER, which is how production connects.
 *
 * `RATE_LIMIT_DB_DIRECT_URL` is an OPTIONAL, DIRECT (non-pooled) Postgres URL
 * used by the two role-switch cases only, falling back to `DATABASE_URL`.
 * Supavisor (supabase CLI >= 2.90) closes the client socket when the backend
 * raises inside a transaction after a `SET LOCAL ROLE`, so through the pooler
 * those two cases surface a `CONNECTION_CLOSED` connection error instead of
 * SQLSTATE 42501. The grant boundary is a property of Postgres, not of the
 * pooler, so it must not be asserted through one. Every other case — including
 * cancellation and the 20-way race — stays on `DATABASE_URL`.
 *
 * Run locally (the pooler username is tenant-qualified — a plain `postgres`
 * gets "Tenant or user not found"; `pooler-dev` is the CLI's fixed local
 * tenant id, not this project's project_id):
 *   supabase start && supabase db reset
 *   DATABASE_URL=postgresql://postgres.pooler-dev:postgres@127.0.0.1:54329/postgres \
 *     RATE_LIMIT_DB_DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     bunx vitest run lib/infra/rate-limit/limiter/__tests__/rate-limit-consume.db.test.ts
 */

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import {
  afterAll,
  beforeAll,
  describe as describeBase,
  expect,
  it,
} from 'vitest';
import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { db, encodeDbUrl } from '@/lib/infra/db/client';
import { createSqlRateLimitConsumer } from '../sql-consumer';

interface ConsumeRow {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number | null;
  remaining_minute: number | null;
  remaining_hour: number | null;
  remaining_day: number | null;
}

const CONSUME_SIGNATURE =
  'public.rate_limit_consume(text,text,text,int,int,int,timestamptz)';

const databaseUrl = process.env.DATABASE_URL;
// Role-switch cases only. See the docblock: on Supavisor an error raised in a
// transaction after `SET LOCAL ROLE` kills the socket, so 42501 never arrives.
const directDatabaseUrl = process.env.RATE_LIMIT_DB_DIRECT_URL ?? databaseUrl;
// The cancellation case needs to saturate the pool the consumer itself uses,
// and `lib/infra/db/client.ts` reads this once, lazily, on first access.
process.env.DB_POOL_MAX = '2';

/** Never put a password in a failure message. */
function redactDbUrl(url: string) {
  return url.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@');
}

const describe = databaseUrl ? describeBase : describeBase.skip;
let sql: postgres.Sql;
let directSql: postgres.Sql;

if (databaseUrl) {
  beforeAll(async () => {
    // `prepare: false` mirrors lib/infra/db/client.ts — PgBouncer transaction
    // mode has no prepared statements, which is exactly why every parameter in
    // the call below carries an explicit ::cast.
    sql = postgres(encodeDbUrl(databaseUrl), { max: 25, prepare: false });
    directSql = postgres(encodeDbUrl(directDatabaseUrl ?? databaseUrl), {
      max: 2,
      prepare: false,
    });

    let present: boolean;

    try {
      const rows = await sql<Array<{ present: boolean }>>`
        SELECT to_regprocedure(${CONSUME_SIGNATURE}) IS NOT NULL AS present
      `;
      present = rows[0]?.present === true;
    } catch (error) {
      throw new Error(
        `DATABASE_URL is set but unreachable — ${redactDbUrl(databaseUrl)}`,
        { cause: error }
      );
    }

    if (!present) {
      throw new Error(
        `DATABASE_URL is set but ${CONSUME_SIGNATURE} is missing — wrong tenant or unapplied migrations? ${redactDbUrl(databaseUrl)}`
      );
    }
  });
}

// Unique per run so repeated runs (and parallel CI jobs) never share counters.
const keyHash = `v1:test-${randomUUID()}`;
const route = `test:rate-limit-consume:${randomUUID()}`;

function consume(
  limits: {
    minute?: number | null;
    hour?: number | null;
    day?: number | null;
  },
  now?: string,
  connection: postgres.Sql = sql
) {
  return connection<ConsumeRow[]>`
    SELECT * FROM public.rate_limit_consume(
      ${'user'}::text,
      ${keyHash}::text,
      ${route}::text,
      ${limits.minute ?? null}::integer,
      ${limits.hour ?? null}::integer,
      ${limits.day ?? null}::integer,
      ${now ?? null}::timestamptz
    )
  `.then((rows) => rows[0]);
}

async function clearCounters() {
  await sql`DELETE FROM public.rate_limit_counters WHERE key_hash = ${keyHash}`;
}

function counterRow<T extends object>() {
  return sql<T[]>`
    SELECT minute_count, hour_count, day_count
    FROM public.rate_limit_counters
    WHERE key_hash = ${keyHash} AND route = ${route}
  `;
}

describe('public.rate_limit_consume', () => {
  afterAll(async () => {
    await clearCounters();
    await sql.end({ timeout: 5 });
    await directSql.end({ timeout: 5 });
  });

  it('inserts on first use and reports remaining headroom', async () => {
    await clearCounters();

    const row = await consume(
      { minute: 3, hour: 10, day: 100 },
      '2026-09-01T10:00:00Z'
    );

    expect(row.allowed).toBe(true);
    expect(row.reason).toBeNull();
    expect(row.remaining_minute).toBe(2);
    expect(row.remaining_hour).toBe(9);
    expect(row.remaining_day).toBe(99);
  });

  it('blocks exactly at the limit and reports the smallest window', async () => {
    await clearCounters();
    const at = '2026-09-01T10:00:30Z';

    await consume({ minute: 2, day: 100 }, at);
    await consume({ minute: 2, day: 100 }, at);
    const blocked = await consume({ minute: 2, day: 100 }, at);

    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('minute');
    // 30s left in the minute.
    expect(blocked.retry_after_seconds).toBe(30);
  });

  it('does not consume anything when it blocks', async () => {
    await clearCounters();
    const at = '2026-09-01T10:00:00Z';

    await consume({ minute: 1, day: 100 }, at);
    await consume({ minute: 1, day: 100 }, at);
    await consume({ minute: 1, day: 100 }, at);

    const [row] = await counterRow<{
      minute_count: number;
      day_count: number;
    }>();

    expect(row.minute_count).toBe(1);
    expect(row.day_count).toBe(1);
  });

  it('rolls minute, hour and day windows forward independently', async () => {
    await clearCounters();
    const limits = { minute: 1, hour: 2, day: 3 };

    expect((await consume(limits, '2026-09-01T10:00:00Z')).allowed).toBe(true);
    expect((await consume(limits, '2026-09-01T10:00:30Z')).allowed).toBe(false);
    // New minute, same hour: hour count reaches its limit of 2.
    expect((await consume(limits, '2026-09-01T10:01:00Z')).allowed).toBe(true);
    expect((await consume(limits, '2026-09-01T10:02:00Z')).allowed).toBe(false);
    // New hour, same day: day count reaches its limit of 3.
    expect((await consume(limits, '2026-09-01T11:00:00Z')).allowed).toBe(true);
    const dayBlocked = await consume(limits, '2026-09-01T12:00:00Z');
    expect(dayBlocked.allowed).toBe(false);
    expect(dayBlocked.reason).toBe('day');
    // New day: everything resets.
    expect((await consume(limits, '2026-09-02T00:00:00Z')).allowed).toBe(true);
  });

  it('rolls windows forward only, so a backwards clock is not a free bucket', async () => {
    await clearCounters();

    expect((await consume({ minute: 1 }, '2026-09-01T10:05:00Z')).allowed).toBe(
      true
    );

    // A skewed instance (or a replayed p_now) reporting an EARLIER minute must
    // not reset the counter — greatest() keeps the stored window.
    const blocked = await consume({ minute: 1 }, '2026-09-01T10:00:00Z');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('minute');
    // Still measured against the stored 10:05 window, which ends at 10:06.
    expect(blocked.retry_after_seconds).toBe(360);

    const [row] = await sql<
      Array<{ minute_start: Date; minute_count: number }>
    >`
      SELECT minute_start, minute_count FROM public.rate_limit_counters
      WHERE key_hash = ${keyHash} AND route = ${route}
    `;
    expect(row.minute_start.toISOString()).toBe('2026-09-01T10:05:00.000Z');
    expect(row.minute_count).toBe(1);
  });

  it('pins windows to UTC regardless of the session TimeZone', async () => {
    await clearCounters();

    const skewed = postgres(encodeDbUrl(databaseUrl ?? ''), {
      max: 1,
      prepare: false,
      // GMT+7. With the 2-arg date_trunc this session would compute a day
      // boundary seven hours away from the one every other backend uses.
      connection: { TimeZone: 'Asia/Ho_Chi_Minh' },
    });

    try {
      // 23:30 UTC is already "tomorrow" in Asia/Ho_Chi_Minh.
      await consume({ day: 1 }, '2026-09-01T23:30:00Z', skewed);
      const blocked = await consume({ day: 1 }, '2026-09-01T23:45:00Z', skewed);

      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe('day');
      // 15 minutes to the UTC midnight boundary, not 8h15m to the GMT+7 one.
      expect(blocked.retry_after_seconds).toBe(900);
    } finally {
      await skewed.end({ timeout: 5 });
    }
  });

  it('never increments an unenforced window', async () => {
    await clearCounters();
    const at = '2026-09-01T10:00:00Z';

    await consume({ day: 5 }, at);
    await consume({ day: 5 }, at);
    await consume({ day: 5 }, at);

    const [row] = await counterRow<{
      minute_count: number;
      hour_count: number;
      day_count: number;
    }>();

    expect(row.minute_count).toBe(0);
    expect(row.hour_count).toBe(0);
    expect(row.day_count).toBe(3);
  });

  it('treats NULL and non-positive limits as unenforced', async () => {
    await clearCounters();
    const at = '2026-09-01T10:00:00Z';

    for (let call = 0; call < 20; call += 1) {
      const row = await consume({}, at);
      expect(row.allowed).toBe(true);
      expect(row.remaining_minute).toBeNull();
    }

    expect((await consume({ minute: 0 }, at)).allowed).toBe(true);
  });

  it('admits exactly perMinute requests under 20-way concurrency', async () => {
    await clearCounters();
    const at = '2026-09-01T10:00:00Z';

    const results = await Promise.all(
      Array.from({ length: 20 }, () => consume({ minute: 5 }, at))
    );

    expect(results.filter((row) => row.allowed)).toHaveLength(5);

    const [row] = await counterRow<{ minute_count: number }>();

    expect(row.minute_count).toBe(5);
  });

  it('is executable by the role the application connects as', async () => {
    // The grants matter only if the DATABASE_URL role can actually call it.
    const [row] = await sql<Array<{ can_execute: boolean }>>`
      SELECT has_function_privilege(
        current_user, ${CONSUME_SIGNATURE}, 'EXECUTE'
      ) AS can_execute
    `;

    expect(row.can_execute).toBe(true);
  });

  it('waits out the LATEST exhausted window, not the smallest', async () => {
    await clearCounters();
    // Minute AND hour exhausted together at 10:00:30.
    const limits = { minute: 2, hour: 2 };
    const at = '2026-09-01T10:00:30Z';

    await consume(limits, at);
    await consume(limits, at);
    const blocked = await consume(limits, at);

    expect(blocked.allowed).toBe(false);
    // The diagnosis is the tightest ceiling...
    expect(blocked.reason).toBe('minute');
    // ...but a client told to come back in 30s would be refused by the hour
    // window for the next 59.5 minutes. 10:00:30 -> 11:00:00 is 3570s.
    expect(blocked.retry_after_seconds).toBe(3570);
  });

  it('denies anon and authenticated, and allows service_role', async () => {
    // `SET LOCAL` inside a transaction rather than SET ROLE / RESET ROLE:
    // consecutive statements are not guaranteed the same backend, so
    // session-scoped role state would silently leak or vanish. A transaction
    // pins one connection and resets on commit. On `directSql` because a
    // role switch inside a pooled transaction is what Supavisor kills the
    // socket over — see the docblock.
    async function privilegesAs(role: string) {
      return directSql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE ${role}`);

        const [row] = await tx<
          Array<{
            can_execute: boolean;
            can_select_counters: boolean;
            can_insert_counters: boolean;
            can_select_events: boolean;
            can_insert_events: boolean;
          }>
        >`
          SELECT
            has_function_privilege(
              current_user, ${CONSUME_SIGNATURE}, 'EXECUTE'
            ) AS can_execute,
            has_table_privilege(
              current_user, 'public.rate_limit_counters', 'SELECT'
            ) AS can_select_counters,
            has_table_privilege(
              current_user, 'public.rate_limit_counters', 'INSERT'
            ) AS can_insert_counters,
            has_table_privilege(
              current_user, 'public.rate_limit_events', 'SELECT'
            ) AS can_select_events,
            has_table_privilege(
              current_user, 'public.rate_limit_events', 'INSERT'
            ) AS can_insert_events
        `;

        return row;
      });
    }

    for (const role of ['anon', 'authenticated']) {
      // A client key must not be able to read which routes are being
      // throttled, nor pre-exhaust anyone else's quota.
      expect(await privilegesAs(role)).toEqual({
        can_execute: false,
        can_select_counters: false,
        can_insert_counters: false,
        can_select_events: false,
        can_insert_events: false,
      });
    }

    expect(await privilegesAs('service_role')).toEqual({
      can_execute: true,
      can_select_counters: true,
      can_insert_counters: true,
      can_select_events: true,
      can_insert_events: true,
    });
  });

  it('actually refuses a consume executed as anon', async () => {
    // The privilege bits above are what Postgres THINKS; this is what it does.
    // On `directSql`: through the pooler the backend error after the role
    // switch reaches us as a closed socket, not as 42501 (see the docblock).
    const attempt = directSql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE anon');
      await tx.unsafe(
        `SELECT * FROM public.rate_limit_consume(
           $1::text, $2::text, $3::text, $4::integer, NULL::integer,
           NULL::integer, NULL::timestamptz
         )`,
        ['user', keyHash, `${route}:anon`, 1]
      );
    });

    await expect(attempt).rejects.toMatchObject({ code: '42501' });
  });

  it('CANCELS the query when the deadline fires on a saturated pool', async () => {
    // A `Promise.race` alone only stops WAITING. The abandoned query keeps its
    // place in postgres.js's queue, later takes one of the two pooled
    // connections, and COMMITS a consume for a request that already got a 503.
    const cancelRoute = `${route}:cancel`;
    const previousTimeout = process.env.LIMITER_DB_TIMEOUT_MS;
    process.env.LIMITER_DB_TIMEOUT_MS = '100';

    // Occupy both connections of the app's own pool (DB_POOL_MAX = 2).
    const client = db.$client;
    const held = [
      client`SELECT pg_sleep(2)`.execute(),
      client`SELECT pg_sleep(2)`.execute(),
    ];

    try {
      const consumer = createSqlRateLimitConsumer();

      await expect(
        consumer.consume({
          keyKind: 'user',
          keyHash,
          route: cancelRoute,
          limits: { perMinute: 5 },
        })
      ).rejects.toBeInstanceOf(RateLimitUnavailableError);

      await Promise.all(held);
      // Give a NON-cancelled query every chance to have run by now.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const rows = await sql<Array<{ minute_count: number }>>`
        SELECT minute_count FROM public.rate_limit_counters
        WHERE route = ${cancelRoute}
      `;

      // The row must not exist: the cancelled consume incremented nothing.
      expect(rows).toHaveLength(0);
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.LIMITER_DB_TIMEOUT_MS;
      } else {
        process.env.LIMITER_DB_TIMEOUT_MS = previousTimeout;
      }
      await sql`DELETE FROM public.rate_limit_counters WHERE route = ${cancelRoute}`;
    }
  });

  it('is readable through the production drizzle consumer', async () => {
    // Everything above talks to the function through raw postgres.js. This is
    // the one case that goes through the code the app actually runs — the row
    // shape drizzle's `execute` hands back is a driver detail, and reading it
    // wrong would only show up in production.
    const consumer = createSqlRateLimitConsumer();
    const consumerRoute = `${route}:drizzle`;
    const input = {
      keyKind: 'user',
      keyHash: keyHash,
      route: consumerRoute,
      limits: { perMinute: 1 },
      now: new Date('2026-09-01T10:00:30.000Z'),
    } as const;

    try {
      const first = await consumer.consume(input);
      expect(first.allowed).toBe(true);
      expect(first.remaining_minute).toBe(0);

      const second = await consumer.consume(input);
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe('minute');
      expect(second.retry_after_seconds).toBe(30);
    } finally {
      await sql`
        DELETE FROM public.rate_limit_counters WHERE route = ${consumerRoute}
      `;
    }
  });
});
