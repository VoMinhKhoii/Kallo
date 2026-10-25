/**
 * The spend brake and the one-at-a-time slot in `public.rate_limit_consume`
 * (11-arg) and `public.rate_limit_release`, against a REAL Postgres.
 *
 * Same contract as `rate-limit-consume.db.test.ts` — read its docblock first:
 * skips only without `DATABASE_URL`, fails loudly on a wrong database, and
 * never EXECUTES a denied function as `anon`/`authenticated` (supautils
 * segfaults the backend; an inheriting probe role is used instead).
 *
 * Every case reserves on its own far-future UTC day and its own key, so runs
 * and parallel CI jobs never share a budget row or a counter.
 */

import { randomInt, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import {
  afterAll,
  beforeAll,
  describe as describeBase,
  expect,
  it,
} from 'vitest';
import { encodeDbUrl } from '@/lib/infra/db/client';

interface ConsumeRow {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number | null;
  remaining_minute: number | null;
  remaining_hour: number | null;
  remaining_day: number | null;
  spend_day: string | Date | null;
}

const CONSUME_SIGNATURE =
  'public.rate_limit_consume(text,text,text,int,int,int,int,int,bigint,bigint,timestamptz)';
const RELEASE_SIGNATURE =
  'public.rate_limit_release(text,text,text,date,bigint,timestamptz)';

const databaseUrl = process.env.DATABASE_URL;
const describe = databaseUrl ? describeBase : describeBase.skip;
let sql: postgres.Sql;

if (databaseUrl) {
  beforeAll(async () => {
    sql = postgres(encodeDbUrl(databaseUrl), { max: 25, prepare: false });

    const [row] = await sql<Array<{ consume: boolean; release: boolean }>>`
      SELECT
        to_regprocedure(${CONSUME_SIGNATURE}) IS NOT NULL AS consume,
        to_regprocedure(${RELEASE_SIGNATURE}) IS NOT NULL AS release
    `;
    if (!row?.consume || !row.release) {
      throw new Error(
        'DATABASE_URL is set but the spend/slot functions are missing — unapplied migrations?'
      );
    }
  });

  afterAll(async () => {
    if (usedDays.length > 0) {
      await sql`DELETE FROM public.ai_spend_days WHERE day = ANY(${usedDays}::date[])`;
    }
    await sql`DELETE FROM public.rate_limit_counters WHERE route = ${route}`;
    await sql.end({ timeout: 5 });
  });
}

const route = `test:rate-limit-spend:${randomUUID()}`;
const usedDays: string[] = [];

/** A fresh far-future UTC day, so no other case or run shares its budget. */
function freshDay(): string {
  const year = 2200 + randomInt(0, 7000);
  const day = `${year}-03-${String(randomInt(10, 28)).padStart(2, '0')}`;
  usedDays.push(day);
  return day;
}

function freshKey() {
  return `v1:test-${randomUUID()}`;
}

interface ConsumeArgs {
  keyHash?: string | null;
  minute?: number | null;
  day?: number | null;
  slot?: number | null;
  slotTtl?: number | null;
  spend?: number | null;
  spendLimit?: number | null;
  now: string;
}

function consume(args: ConsumeArgs, connection: postgres.Sql = sql) {
  return connection<ConsumeRow[]>`
    SELECT * FROM public.rate_limit_consume(
      ${'user'}::text,
      ${args.keyHash ?? null}::text,
      ${route}::text,
      ${args.minute ?? null}::integer,
      ${null}::integer,
      ${args.day ?? null}::integer,
      ${args.slot ?? null}::integer,
      ${args.slotTtl ?? null}::integer,
      ${args.spend ?? null}::bigint,
      ${args.spendLimit ?? null}::bigint,
      ${args.now}::timestamptz
    )
  `.then((rows) => rows[0]);
}

function release(args: {
  keyHash?: string | null;
  spendDay?: string | null;
  delta?: number | null;
  now: string;
}) {
  return sql`
    SELECT public.rate_limit_release(
      ${'user'}::text,
      ${args.keyHash ?? null}::text,
      ${route}::text,
      ${args.spendDay ?? null}::date,
      ${args.delta ?? null}::bigint,
      ${args.now}::timestamptz
    )
  `;
}

async function spentOn(day: string) {
  const [row] = await sql<
    Array<{ spent: string; first_blocked_at: Date | null }>
  >`
    SELECT spent_micro_usd::text AS spent, first_blocked_at
    FROM public.ai_spend_days WHERE day = ${day}::date
  `;
  return row
    ? { spent: Number(row.spent), blockedAt: row.first_blocked_at }
    : null;
}

async function counterOf(keyHash: string) {
  const [row] = await sql<Array<{ day_count: number; slot_count: number }>>`
    SELECT day_count, slot_count FROM public.rate_limit_counters
    WHERE key_hash = ${keyHash} AND route = ${route}
  `;
  return row ?? null;
}

function isoDay(value: string | Date | null) {
  if (value == null) return null;
  return typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

describe('rate_limit_consume — spend brake', () => {
  it('reserves until the next reservation would cross the limit', async () => {
    const day = freshDay();
    const now = `${day}T22:00:00Z`;

    const first = await consume({ spend: 400, spendLimit: 1000, now });
    const second = await consume({ spend: 400, spendLimit: 1000, now });
    const third = await consume({ spend: 400, spendLimit: 1000, now });

    expect(first.allowed).toBe(true);
    expect(isoDay(first.spend_day)).toBe(day);
    expect(second.allowed).toBe(true);
    expect(third).toMatchObject({ allowed: false, reason: 'budget' });
    // 22:00 UTC -> next UTC midnight is two hours away.
    expect(third.retry_after_seconds).toBe(7200);
    expect(third.spend_day).toBeNull();
    // The refusal reserved nothing, and stamped the trip once.
    const after = await spentOn(day);
    expect(after?.spent).toBe(800);
    expect(after?.blockedAt).not.toBeNull();
  });

  it('stamps first_blocked_at once, not on every refusal', async () => {
    const day = freshDay();
    await consume({ spend: 1000, spendLimit: 1000, now: `${day}T01:00:00Z` });
    await consume({ spend: 1, spendLimit: 1000, now: `${day}T02:00:00Z` });
    const first = (await spentOn(day))?.blockedAt;
    await consume({ spend: 1, spendLimit: 1000, now: `${day}T03:00:00Z` });

    expect(first?.toISOString()).toBe(`${day}T02:00:00.000Z`);
    expect((await spentOn(day))?.blockedAt?.toISOString()).toBe(
      first?.toISOString()
    );
  });

  it('a key refused on its window reserves no spend', async () => {
    const day = freshDay();
    const keyHash = freshKey();
    const now = `${day}T10:00:00Z`;

    await consume({ keyHash, day: 1, spend: 100, spendLimit: 1000, now });
    const refused = await consume({
      keyHash,
      day: 1,
      spend: 100,
      spendLimit: 1000,
      now,
    });

    expect(refused).toMatchObject({ allowed: false, reason: 'day' });
    expect((await spentOn(day))?.spent).toBe(100);
  });

  it('a budget refusal leaves the key counters untouched', async () => {
    const day = freshDay();
    const keyHash = freshKey();
    const now = `${day}T10:00:00Z`;

    await consume({ keyHash, day: 30, spend: 900, spendLimit: 1000, now });
    const refused = await consume({
      keyHash,
      day: 30,
      spend: 900,
      spendLimit: 1000,
      now,
    });

    expect(refused.reason).toBe('budget');
    expect((await counterOf(keyHash))?.day_count).toBe(1);
  });

  it('never admits past the limit under concurrent reservations', async () => {
    const day = freshDay();
    const now = `${day}T10:00:00Z`;

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consume({ spend: 100, spendLimit: 1000, now })
      )
    );

    expect(results.filter((row) => row.allowed)).toHaveLength(10);
    expect((await spentOn(day))?.spent).toBe(1000);
  });

  it('pins the spend day to UTC whatever the session TimeZone', async () => {
    const day = freshDay();
    // 23:30 UTC is already the next day in Kiritimati (UTC+14).
    const row = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL TimeZone = 'Pacific/Kiritimati'`);
      const [r] = await tx<ConsumeRow[]>`
        SELECT * FROM public.rate_limit_consume(
          'user'::text, NULL::text, ${route}::text, NULL::integer,
          NULL::integer, NULL::integer, NULL::integer, NULL::integer,
          ${5}::bigint, ${1000}::bigint, ${`${day}T23:30:00Z`}::timestamptz
        )
      `;
      return r;
    });

    expect(isoDay(row.spend_day)).toBe(day);
    expect((await spentOn(day))?.spent).toBe(5);
  });

  it('settles a negative delta down to the real cost, never below zero', async () => {
    const day = freshDay();
    const now = `${day}T10:00:00Z`;

    await consume({ spend: 30_000, spendLimit: 10_000_000, now });
    await release({ spendDay: day, delta: 4800 - 30_000, now });
    expect((await spentOn(day))?.spent).toBe(4800);

    await release({ spendDay: day, delta: -1_000_000, now });
    expect((await spentOn(day))?.spent).toBe(0);
  });

  it('settles a late cost onto a day that has no row yet', async () => {
    const day = freshDay();
    await release({ spendDay: day, delta: 250, now: `${day}T00:00:05Z` });
    expect((await spentOn(day))?.spent).toBe(250);
  });

  it('refuses a reservation with no limit, and a call with nothing to do', async () => {
    const now = `${freshDay()}T10:00:00Z`;
    await expect(consume({ spend: 1, now })).rejects.toThrow(/needs a limit/);
    await expect(consume({ now })).rejects.toThrow(/nothing to consume/);
  });
});

describe('rate_limit_consume — one-at-a-time slot', () => {
  it('holds one slot, refuses a second, and frees it on release', async () => {
    const keyHash = freshKey();
    const now = '2026-09-01T10:00:00Z';

    const first = await consume({ keyHash, slot: 1, slotTtl: 90, now });
    const second = await consume({ keyHash, slot: 1, slotTtl: 90, now });
    expect(first.allowed).toBe(true);
    expect(second).toMatchObject({ allowed: false, reason: 'concurrent' });
    // The slot's lifetime is what is left of it.
    expect(second.retry_after_seconds).toBe(90);

    await release({ keyHash, now: '2026-09-01T10:00:20Z' });
    const third = await consume({
      keyHash,
      slot: 1,
      slotTtl: 90,
      now: '2026-09-01T10:00:21Z',
    });
    expect(third.allowed).toBe(true);
  });

  it('a slot whose lifetime ran out reads as free', async () => {
    const keyHash = freshKey();
    await consume({
      keyHash,
      slot: 1,
      slotTtl: 90,
      now: '2026-09-01T10:00:00Z',
    });
    const later = await consume({
      keyHash,
      slot: 1,
      slotTtl: 90,
      now: '2026-09-01T10:01:31Z',
    });
    expect(later.allowed).toBe(true);
    expect((await counterOf(keyHash))?.slot_count).toBe(1);
  });

  it('a refusal on the slot does not count against the day window', async () => {
    const keyHash = freshKey();
    const now = '2026-09-01T10:00:00Z';
    await consume({ keyHash, day: 30, slot: 1, slotTtl: 90, now });
    const refused = await consume({
      keyHash,
      day: 30,
      slot: 1,
      slotTtl: 90,
      now,
    });

    expect(refused.reason).toBe('concurrent');
    expect((await counterOf(keyHash))?.day_count).toBe(1);
  });

  it('reports the window, not the slot, when both are out', async () => {
    const keyHash = freshKey();
    const now = '2026-09-01T23:00:00Z';
    await consume({ keyHash, day: 1, slot: 1, slotTtl: 90, now });
    const refused = await consume({
      keyHash,
      day: 1,
      slot: 1,
      slotTtl: 90,
      now,
    });

    expect(refused.reason).toBe('day');
    expect(refused.retry_after_seconds).toBe(3600);
  });

  it('releasing more than was taken never goes below zero', async () => {
    const keyHash = freshKey();
    const now = '2026-09-01T10:00:00Z';
    await consume({ keyHash, slot: 2, slotTtl: 90, now });
    await release({ keyHash, now });
    await release({ keyHash, now });
    expect((await counterOf(keyHash))?.slot_count).toBe(0);
  });

  it('refuses a slot with no lifetime', async () => {
    await expect(
      consume({ keyHash: freshKey(), slot: 1, now: '2026-09-01T10:00:00Z' })
    ).rejects.toThrow(/positive ttl/);
  });
});

describe('rate_limit_consume / rate_limit_release — grants', () => {
  it("refuses both functions executed with anon's privileges", async () => {
    // Inheriting probe role, never `anon` itself — see the file docblock.
    const probeRole = `rl_spend_probe_${randomUUID().replace(/-/g, '')}`;
    await sql.unsafe(`CREATE ROLE "${probeRole}" INHERIT IN ROLE anon`);

    try {
      const [{ role: connectedRole }] = await sql<Array<{ role: string }>>`
        SELECT current_user AS role
      `;
      await sql.unsafe(`GRANT "${probeRole}" TO "${connectedRole}"`);

      for (const statement of [
        `SELECT * FROM public.rate_limit_consume('user'::text, NULL::text, 'x'::text,
           NULL::integer, NULL::integer, NULL::integer, NULL::integer,
           NULL::integer, 1::bigint, 10::bigint, NULL::timestamptz)`,
        `SELECT public.rate_limit_release('user'::text, NULL::text, 'x'::text,
           NULL::date, NULL::bigint, NULL::timestamptz)`,
      ]) {
        const attempt = sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE "${probeRole}"`);
          await tx.unsafe(statement);
        });
        await expect(attempt).rejects.toMatchObject({ code: '42501' });
      }

      const [grants] = await sql<
        Array<{ consume: boolean; release: boolean; table: boolean }>
      >`
        SELECT
          has_function_privilege('service_role', ${CONSUME_SIGNATURE}, 'EXECUTE') AS consume,
          has_function_privilege('service_role', ${RELEASE_SIGNATURE}, 'EXECUTE') AS release,
          has_table_privilege('anon', 'public.ai_spend_days', 'UPDATE') AS table
      `;
      expect(grants).toEqual({ consume: true, release: true, table: false });
    } finally {
      await sql.unsafe(`DROP ROLE IF EXISTS "${probeRole}"`);
    }
  });
});
