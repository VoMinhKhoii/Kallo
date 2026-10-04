// Runs the real /admin/premium SQL against a disposable Postgres. Opt-in: set
// PREMIUM_GRANT_TEST_DATABASE_URL to a throwaway database that has
// `auth.users` (id, email, created_at), `public.public_profiles`, and the
// billing + premium admin migrations applied. Never point it at a shared or
// production database — it writes grants and changes the welcome offer.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getAccount } from '@/lib/admin/premium/accounts/lookup';
import { getOverview } from '@/lib/admin/premium/accounts/overview';
import { searchAccounts } from '@/lib/admin/premium/accounts/search';
import { undoAction } from '@/lib/admin/premium/activity/undo';
import { endFreePremium } from '@/lib/admin/premium/grants/end';
import { givePremium } from '@/lib/admin/premium/grants/give';
import {
  getWelcomeOffer,
  saveWelcomeOffer,
} from '@/lib/admin/premium/offer/offer';
import { countWho } from '@/lib/admin/premium/targets/count-who';
import type { AppDb } from '@/lib/infra/db/client';
import * as schema from '@/lib/infra/db/schema';

const url = process.env.PREMIUM_GRANT_TEST_DATABASE_URL;
const client = url ? postgres(url, { max: 1 }) : null;
const db = (client ? drizzle(client, { schema }) : null) as AppDb;
const admin = { id: crypto.randomUUID(), email: 'admin@test.local' };
const DAY = 86_400_000;

describe.skipIf(!client)('/admin/premium (real Postgres)', () => {
  let tag: string;
  beforeEach(() => {
    tag = crypto.randomUUID().slice(0, 8);
  });
  afterAll(async () => {
    await client?.end();
  });

  async function user(label: string, name?: string): Promise<string> {
    const [row] = await client!`
      INSERT INTO auth.users (email) VALUES (${`${label}-${tag}@x.com`})
      RETURNING id::text AS id`;
    const id = row.id as string;
    if (name) {
      await client!`
        INSERT INTO public.public_profiles (user_id, handle, display_name)
        VALUES (${id}::uuid, ${`${label}-${tag}`}, ${name})`;
    }
    // The signup trigger gave a welcome grant; start each account clean.
    await client!`DELETE FROM public.entitlement_grants WHERE user_id = ${id}::uuid`;
    return id;
  }

  async function payFor(id: string) {
    await client!`
      INSERT INTO public.entitlement_grants (user_id, entitlement_key, source,
        environment, starts_at, expires_at, status, will_renew, external_ref)
      VALUES (${id}::uuid, 'premium', 'revenuecat', 'production',
        now() - interval '1 day', now() + interval '30 days', 'active', true,
        ${`rc-${tag}-${id}`})`;
  }

  async function freeUntil(id: string): Promise<Date | null> {
    return (await getAccount(db, id))?.freeUntil ?? null;
  }

  it('gives named accounts Premium, skipping a paying one', async () => {
    const free = await user('free');
    const paying = await user('paying');
    await payFor(paying);

    const who = { kind: 'users' as const, userIds: [free, paying] };
    expect(await countWho(db, who)).toEqual({ accounts: 1, payingSkipped: 1 });

    const result = await givePremium(
      admin,
      {
        who,
        length: { unit: 'days', days: 10 },
        mode: 'extend',
        reason: 'test',
      },
      { db }
    );
    expect(result.userCount).toBe(1);
    expect((await getAccount(db, free))?.plan).toBe('complimentary');
    expect((await getAccount(db, paying))?.grants).toHaveLength(1);
  });

  it('extend adds on top of free time left; restart counts from now', async () => {
    const a = await user('extend');
    const give = (mode: 'extend' | 'restart') =>
      givePremium(
        admin,
        {
          who: { kind: 'users', userIds: [a] },
          length: { unit: 'days', days: 10 },
          mode,
          reason: 'test',
        },
        { db }
      );

    await give('extend');
    await give('extend');
    const twenty = (await freeUntil(a))!.getTime() - Date.now();
    expect(Math.round(twenty / DAY)).toBe(20);

    await give('restart');
    // Restart's 10 days end before the 20 already granted: the longer stays.
    expect(
      Math.round(((await freeUntil(a))!.getTime() - Date.now()) / DAY)
    ).toBe(20);
  });

  it('ends free Premium, never paid, and undo brings it back', async () => {
    const a = await user('end');
    const paying = await user('endpay');
    await payFor(paying);
    await givePremium(
      admin,
      {
        who: { kind: 'users', userIds: [a, paying] },
        length: { unit: 'days', days: 7 },
        mode: 'extend',
        reason: 'test',
      },
      { db }
    );

    const ended = await endFreePremium(
      admin,
      { who: { kind: 'users', userIds: [a, paying] }, reason: 'test' },
      { db }
    );
    expect(ended.userCount).toBe(1);
    expect((await getAccount(db, a))?.plan).toBe('free');
    expect((await getAccount(db, paying))?.plan).toBe('paying');

    expect(
      (await undoAction(admin, ended.auditId, 'oops', { db })).userCount
    ).toBe(1);
    expect((await getAccount(db, a))?.plan).toBe('complimentary');
    await expect(
      undoAction(admin, ended.auditId, 'again', { db })
    ).rejects.toThrow('already undone');
  });

  it('undoing a grant cancels exactly what it created', async () => {
    const a = await user('undogrant');
    const given = await givePremium(
      admin,
      {
        who: { kind: 'users', userIds: [a] },
        length: { unit: 'days', days: 5 },
        mode: 'extend',
        reason: 'test',
      },
      { db }
    );
    await undoAction(admin, given.auditId, 'mistake', { db });
    expect((await getAccount(db, a))?.plan).toBe('free');
  });

  it('a group reaches only the matching plan and signup window', async () => {
    const onFree = await user('grpfree');
    const onPromo = await user('grppromo');
    await givePremium(
      admin,
      {
        who: { kind: 'users', userIds: [onPromo] },
        length: { unit: 'days', days: 3 },
        mode: 'extend',
        reason: 'test',
      },
      { db }
    );
    const today = new Date().toISOString().slice(0, 10);
    const ids = [onFree, onPromo];
    const reach = async (plan: 'free' | 'complimentary' | 'not_paying') => {
      const rows = await client!`SELECT id::text AS id FROM auth.users
        WHERE id = ANY(${ids}::uuid[])`;
      expect(rows).toHaveLength(2);
      return countWho(db, {
        kind: 'group',
        plan,
        joinedFrom: today,
        joinedTo: today,
      });
    };
    // Others created today also match, so compare relative to each other.
    const free = (await reach('free')).accounts;
    const promo = (await reach('complimentary')).accounts;
    const all = (await reach('not_paying')).accounts;
    expect(free + promo).toBe(all);
    expect(
      (
        await countWho(db, {
          kind: 'group',
          plan: 'free',
          joinedTo: '2000-01-01',
        })
      ).accounts
    ).toBe(0);
  });

  it('saves the welcome offer, feeds the signup trigger, and undoes', async () => {
    const before = await getWelcomeOffer(db);
    await saveWelcomeOffer(
      admin,
      { enabled: true, days: 30, autoOffOn: null, reason: 'test' },
      { db }
    );
    const [{ id }] = await client!`
      INSERT INTO auth.users (email) VALUES (${`signup-${tag}@x.com`})
      RETURNING id::text AS id`;
    const until = await freeUntil(id as string);
    expect(Math.round((until!.getTime() - Date.now()) / DAY)).toBe(30);

    const [last] =
      await client!`SELECT id::text AS id FROM public.premium_grant_audit
      WHERE action = 'offer' ORDER BY created_at DESC LIMIT 1`;
    await undoAction(admin, last.id as string, 'revert', { db });
    expect((await getWelcomeOffer(db)).days).toBe(before.days);
  });

  it('finds accounts by email or name, with their plan', async () => {
    const id = await user('searchme', `Mai Nguyễn ${tag}`);
    const byName = await searchAccounts(db, `Nguyễn ${tag}`);
    expect(byName.map((m) => m.id)).toEqual([id]);
    expect(byName[0]?.plan).toBe('free');
    const byEmail = await searchAccounts(db, `searchme-${tag}`);
    expect(byEmail[0]?.id).toBe(id);
    // A literal % is not a wildcard.
    expect(await searchAccounts(db, `%${tag}%`)).toEqual([]);
  });

  it('reports the overview counts', async () => {
    const overview = await getOverview(db);
    expect(overview.onFreePremium).toBeGreaterThan(0);
    expect(overview.paying).toBeGreaterThan(0);
  });
});
