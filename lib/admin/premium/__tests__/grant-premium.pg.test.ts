// Runs the real grant SQL against a disposable Postgres. Opt-in: set
// PREMIUM_GRANT_TEST_DATABASE_URL to a throwaway database that has an
// `auth.users` table and the billing + premium_grant_audit migrations applied.
// Never point it at a shared or production database — it writes grants.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { grantPremium } from '@/lib/admin/premium/grant-premium';
import { isAppError } from '@/lib/core/errors/app-error';
import type { AppDb } from '@/lib/infra/db/client';
import * as schema from '@/lib/infra/db/schema';

const url = process.env.PREMIUM_GRANT_TEST_DATABASE_URL;
const client = url ? postgres(url, { max: 1 }) : null;
const db = (client ? drizzle(client, { schema }) : null) as AppDb;
const admin = { id: crypto.randomUUID(), email: 'admin@test.local' };
const now = new Date('2026-10-04T00:00:00.000Z');

describe.skipIf(!client)('grantPremium (real Postgres)', () => {
  afterAll(async () => {
    await client?.end();
  });

  async function newUser(email: string): Promise<string> {
    const [row] = await client!`
      INSERT INTO auth.users (email) VALUES (${email}) RETURNING id::text AS id`;
    return row.id as string;
  }

  async function grantsFor(auditId: string) {
    return client!`
      SELECT user_id::text, environment, source, status, will_renew,
             starts_at, expires_at
      FROM public.entitlement_grants
      WHERE external_ref LIKE ${`admin:${auditId}:%`}
      ORDER BY user_id, environment`;
  }

  it('grants named accounts in both environments and audits it', async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    const a = await newUser(`a-${tag}@x.com`);
    const b = await newUser(`b-${tag}@x.com`);
    await newUser(`untouched-${tag}@x.com`);

    const result = await grantPremium(
      admin,
      {
        scope: 'users',
        days: 30,
        emails: [`a-${tag}@x.com`, `b-${tag}@x.com`],
      },
      { db, now: () => now }
    );

    expect(result.userCount).toBe(2);
    expect(result.expiresAt.toISOString()).toBe('2026-11-03T00:00:00.000Z');
    const rows = await grantsFor(result.auditId);
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set([a, b]));
    for (const row of rows) {
      expect(row).toMatchObject({
        source: 'promo',
        status: 'active',
        will_renew: false,
      });
    }

    const [audit] = await client!`
      SELECT admin_email, scope, days, user_count,
             array_length(target_user_ids, 1) AS targets
      FROM public.premium_grant_audit WHERE id = ${result.auditId}`;
    expect(audit).toEqual({
      admin_email: 'admin@test.local',
      scope: 'users',
      days: 30,
      user_count: 2,
      targets: 2,
    });
  });

  it('writes nothing when any email has no account', async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    await newUser(`real-${tag}@x.com`);
    const before =
      await client!`SELECT count(*)::int AS n FROM public.premium_grant_audit`;

    const error = await grantPremium(
      admin,
      {
        scope: 'users',
        days: 7,
        emails: [`real-${tag}@x.com`, `typo-${tag}@x.com`],
      },
      { db, now: () => now }
    ).catch((e: unknown) => e);

    expect(isAppError(error) && error.userMessage).toBe(
      `No account for: typo-${tag}@x.com`
    );
    const after =
      await client!`SELECT count(*)::int AS n FROM public.premium_grant_audit`;
    expect(after[0].n).toBe(before[0].n);
  });

  it('grants every account for scope everyone', async () => {
    const [{ n: users }] =
      await client!`SELECT count(*)::int AS n FROM auth.users`;
    const result = await grantPremium(
      admin,
      { scope: 'everyone', days: 1 },
      { db, now: () => now }
    );
    expect(result.userCount).toBe(users);
    expect(await grantsFor(result.auditId)).toHaveLength(users * 2);
  });
});
