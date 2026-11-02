/** Real DB regression for removal as withdrawn consent, run by CI's migrations
 * job; skips only without a URL. The service functions commit, so each case
 * uses fresh users, deleted (with everything that cascades) afterwards.
 */
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it, vi } from 'vitest';

// The post-commit push needs a request scope; what it sends is covered by the
// notifications suites. The notification ROW is real and asserted below.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: vi.fn(),
}));
vi.mock('@/lib/domain/notifications/push', () => ({
  sendNotificationPush: vi.fn(async () => undefined),
  sendChatMessagePush: vi.fn(async () => undefined),
}));

import { acceptInvite, removeFriend } from '@/lib/actions/groups/friendship';
import { getOrCreateMyProfile } from '@/lib/actions/groups/profile';
import type { Db } from '@/lib/actions/groups/types';
import { encodeDbUrl } from '@/lib/infra/db/client';
import * as schema from '@/lib/infra/db/schema';

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl
  ? postgres(encodeDbUrl(databaseUrl), { max: 2, prepare: false })
  : null;
const db = (sql ? drizzle(sql, { schema }) : null) as Db;
const created: string[] = [];

function pg() {
  if (!sql) throw new Error('DATABASE_URL required');
  return sql;
}

afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM auth.users WHERE id = ANY(${created}::uuid[])`;
  // Deleting the accounts reserved their handles; those rows have no FK.
  await sql`DELETE FROM public.released_handles WHERE user_id = ANY(${created}::uuid[])`;
  await sql.end({ timeout: 5 });
});

async function newUser() {
  const id = randomUUID();
  await pg()`INSERT INTO auth.users (id) VALUES (${id})`;
  created.push(id);
  const { handle } = await getOrCreateMyProfile(id, null, db);
  return { id, handle };
}

async function pairState(a: string, b: string) {
  const [low, high] = [a, b].sort();
  const [row] = await pg()`
    SELECT
      (SELECT count(*)::int FROM public.friendships
        WHERE user_low = ${low} AND user_high = ${high}) AS edges,
      (SELECT count(*)::int FROM public.notifications
        WHERE recipient_id = ${a} AND type = 'friend.joined') AS joined_notices,
      (SELECT count(*)::int FROM public.chat_group_members m
        JOIN public.chat_groups g ON g.id = m.group_id
        WHERE g.kind = 'direct' AND g.direct_user_low = ${low}
          AND g.direct_user_high = ${high} AND m.user_id = ${a}) AS memberships,
      (SELECT count(*)::int FROM public.friend_removals
        WHERE remover_id = ${a} AND removed_id = ${b}) AS removals
  `;
  return row;
}

describe.skipIf(!databaseUrl)('removing a friend withdraws consent', () => {
  it("refuses the removed person's accept of the remover's link, writing nothing", async () => {
    const remover = await newUser();
    const removed = await newUser();
    await acceptInvite(removed.id, { slug: remover.handle }, db);
    await removeFriend(remover.id, { targetUserId: removed.id }, db);
    // The remover also left the direct chat; a re-accept used to re-add them.
    await pg()`
      DELETE FROM public.chat_group_members m USING public.chat_groups g
      WHERE g.id = m.group_id AND g.kind = 'direct' AND m.user_id = ${remover.id}
    `;
    const before = await pairState(remover.id, removed.id);
    expect(before).toMatchObject({ edges: 0, memberships: 0, removals: 1 });

    const refused = await acceptInvite(
      removed.id,
      { slug: remover.handle },
      db
    ).catch((error) => error);
    const unknown = await acceptInvite(removed.id, { slug: 'zz_no_such' }, db)
      .then(() => null)
      .catch((error) => error);

    expect(refused).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(refused.message).toBe(unknown.message);
    expect(await pairState(remover.id, removed.id)).toEqual(before);
  });

  it("reconnects when the remover accepts the removed person's link, clearing the removal", async () => {
    const remover = await newUser();
    const removed = await newUser();
    await acceptInvite(removed.id, { slug: remover.handle }, db);
    await removeFriend(remover.id, { targetUserId: removed.id }, db);

    const result = await acceptInvite(remover.id, { slug: removed.handle }, db);

    expect(result.status).toBe('accepted');
    expect(await pairState(remover.id, removed.id)).toMatchObject({
      edges: 1,
      removals: 0,
    });
    // Consent is restored both ways: the removed person's link works again.
    await expect(
      acceptInvite(removed.id, { slug: remover.handle }, db)
    ).resolves.toMatchObject({ status: 'accepted' });
  });

  it('keeps a removal by the other side in force when the remover accepts', async () => {
    const a = await newUser();
    const b = await newUser();
    await acceptInvite(b.id, { slug: a.handle }, db);
    await removeFriend(a.id, { targetUserId: b.id }, db);
    await removeFriend(b.id, { targetUserId: a.id }, db);

    await expect(
      acceptInvite(a.id, { slug: b.handle }, db)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(await pairState(a.id, b.id)).toMatchObject({
      edges: 0,
      removals: 1,
    });
  });

  it('answers removing an unknown user with a 404', async () => {
    const actor = await newUser();
    await expect(
      removeFriend(actor.id, { targetUserId: randomUUID() }, db)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
