/** Real DB regression, run by CI's migrations job; skips only without a URL.
 * Role switches and JWT claims stay transaction-local for the pooler. Check
 * EXECUTE before invoking: a denied function call is unsafe on hosted Postgres.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { encodeDbUrl } from '@/lib/infra/db/client';

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl
  ? postgres(encodeDbUrl(databaseUrl), { max: 1, prepare: false })
  : null;

afterAll(async () => {
  await sql?.end({ timeout: 5 });
});

async function withPair(
  run: (
    tx: postgres.TransactionSql,
    a: string,
    b: string,
    c: string
  ) => Promise<void>
) {
  if (!sql) throw new Error('DATABASE_URL required');
  const rollback = new Error('rollback fixture');
  try {
    await sql.begin(async (tx) => {
      const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()].sort();
      await tx`INSERT INTO auth.users (id) VALUES (${a}), (${b}), (${c})`;
      await tx`
        INSERT INTO public.friendships (user_low, user_high, requested_by, status)
        VALUES (${a}, ${b}, ${a}, 'accepted')
      `;
      await tx`
        INSERT INTO public.coach_assignments (coach_id, client_id, status)
        VALUES (${a}, ${b}, 'active')
      `;
      await run(tx, a, b, c);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function enterRole(
  tx: postgres.TransactionSql,
  role: 'anon' | 'authenticated',
  userId: string | null
) {
  const [grants] = await tx`
    SELECT
      has_function_privilege(${role}, 'public.is_accepted_friend(uuid,uuid)', 'EXECUTE') AS friend,
      has_function_privilege(${role}, 'public.is_active_coach_of(uuid,uuid)', 'EXECUTE') AS coach,
      has_function_privilege(${role}, 'public.is_friend_since(uuid,uuid,timestamptz)', 'EXECUTE') AS since
  `;
  expect(grants.friend).toBe(true);
  expect(grants.coach).toBe(true);
  if (role === 'authenticated') expect(grants.since).toBe(true);
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role })}, true)`;
  await tx`SELECT set_config('request.jwt.claim.sub', ${userId ?? ''}, true)`;
  await tx.unsafe(`SET LOCAL ROLE ${role}`);
  return grants;
}

async function predicates(
  tx: postgres.TransactionSql,
  viewer: string | null,
  owner: string,
  since: boolean
) {
  const [row] = await tx`
    SELECT public.is_accepted_friend(${viewer}::uuid, ${owner}::uuid) AS friend,
      public.is_active_coach_of(${viewer}::uuid, ${owner}::uuid) AS coach
  `;
  if (since) {
    const [bound] = await tx`
      SELECT public.is_friend_since(${viewer}::uuid, ${owner}::uuid, clock_timestamp()) AS since
    `;
    return { ...row, ...bound };
  }
  return row;
}

describe.skipIf(!databaseUrl)('caller-bound relationship helpers', () => {
  it('returns false to anon for an existing pair without changing grants', async () => {
    await withPair(async (tx, a, b) => {
      const grants = await enterRole(tx, 'anon', null);
      const result = await predicates(tx, a, b, grants.since);
      expect(Object.values(result).every((value) => value === false)).toBe(
        true
      );
    });
  });

  it('returns false to a non-party authenticated caller, including null viewer', async () => {
    await withPair(async (tx, a, b, c) => {
      await enterRole(tx, 'authenticated', c);
      expect(await predicates(tx, a, b, true)).toEqual({
        friend: false,
        coach: false,
        since: false,
      });
      expect(await predicates(tx, null, b, true)).toEqual({
        friend: false,
        coach: false,
        since: false,
      });
    });
  });

  it('keeps policy-shaped calls true for the viewer and honors the time bound', async () => {
    await withPair(async (tx, a, b) => {
      await enterRole(tx, 'authenticated', a);
      const [row] = await tx`
        SELECT public.is_accepted_friend(auth.uid(), ${b}::uuid) AS friend,
          public.is_active_coach_of(auth.uid(), ${b}::uuid) AS coach,
          public.is_friend_since(auth.uid(), ${b}::uuid, clock_timestamp()) AS since,
          public.is_friend_since(auth.uid(), ${b}::uuid, '2000-01-01'::timestamptz) AS before
      `;
      expect(row).toEqual({
        friend: true,
        coach: true,
        since: true,
        before: false,
      });
    });
  });
});
