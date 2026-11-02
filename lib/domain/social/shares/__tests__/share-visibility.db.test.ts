/** CI's migrations job runs this against local Supabase. Fixtures roll back;
 * without DATABASE_URL this suite skips, with one set any DB error fails.
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { listMyChatGroups } from '@/lib/actions/chat-groups/create-and-list';
import { getOrCreateDirectChatGroup } from '@/lib/actions/chat-groups/direct-chats';
import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { removeFriend } from '@/lib/actions/groups/friendship';
import { newestGroupSharedAt } from '@/lib/domain/social/feed/group-meals';
import { canViewShare } from '@/lib/domain/social/shares/share-visibility';
import { type AppTransaction, encodeDbUrl } from '@/lib/infra/db/client';
import * as schema from '@/lib/infra/db/schema';

const databaseUrl = process.env.DATABASE_URL;
const client = databaseUrl
  ? postgres(encodeDbUrl(databaseUrl), { max: 1, prepare: false })
  : null;

afterAll(async () => {
  await client?.end({ timeout: 5 });
});

async function withPair(
  run: (tx: AppTransaction, viewer: string, owner: string) => Promise<void>
) {
  if (!client) throw new Error('DATABASE_URL required');
  const db = drizzle(client, { schema });
  const rollback = new Error('rollback fixture');
  try {
    await db.transaction(async (tx) => {
      const [viewer, owner] = [randomUUID(), randomUUID()].sort();
      await tx.execute(
        sql`INSERT INTO auth.users (id) VALUES (${viewer}), (${owner})`
      );
      await tx.insert(schema.publicProfiles).values([
        { userId: viewer, handle: `v${viewer}`, avatarSeed: viewer },
        { userId: owner, handle: `o${owner}`, avatarSeed: owner },
      ]);
      await befriend(tx, viewer, owner);
      await run(tx, viewer, owner);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function befriend(tx: AppTransaction, viewer: string, owner: string) {
  await tx.insert(schema.friendships).values({
    userLow: viewer,
    userHigh: owner,
    requestedBy: owner,
    status: 'accepted',
  });
}

// The real removeFriend, inside the fixture transaction: its own transaction
// (pair lock, edge delete, removal row) nests as a savepoint.
function unfriend(tx: AppTransaction, viewer: string, owner: string) {
  return removeFriend(
    viewer,
    { targetUserId: owner },
    tx as unknown as Parameters<typeof removeFriend>[2]
  );
}

async function shareMeal(tx: AppTransaction, owner: string) {
  const [meal] = await tx
    .insert(schema.meals)
    .values({ userId: owner, rawInput: 'test meal' })
    .returning();
  const [share] = await tx
    .insert(schema.mealShares)
    .values({
      mealId: meal.id,
      actorId: owner,
      visibility: 'circle',
      // Distinguish lifecycle events within this transaction, like the real
      // accepted_at trigger (which also uses clock_timestamp()).
      sharedAt: sql`clock_timestamp()`,
      eatenAt: meal.loggedAt,
    })
    .returning();
  return share;
}

describe.skipIf(!databaseUrl)(
  'group share visibility across re-friending',
  () => {
    it.each([
      'remove',
      'block',
    ] as const)('hides %s-gap shares from feed, marker, unread and activity rank', async (ending) => {
      await withPair(async (tx, viewer, owner) => {
        const direct = await getOrCreateDirectChatGroup(viewer, owner, tx);
        const [named] = await tx
          .insert(schema.chatGroups)
          .values({ kind: 'group', name: 'test group', createdBy: viewer })
          .returning();
        await tx.insert(schema.chatGroupMembers).values([
          { groupId: named.id, userId: viewer, role: 'owner' },
          { groupId: named.id, userId: owner, role: 'member' },
        ]);
        await tx.execute(sql`
        UPDATE public.chat_group_members
        SET joined_at = now() - interval '1 day', last_read_at = now() - interval '1 day'
        WHERE group_id IN (${direct.id}, ${named.id})
      `);
        await tx.execute(sql`
        UPDATE public.chat_groups SET updated_at = now() - interval '2 hours' WHERE id = ${direct.id}
      `);
        await tx.execute(sql`
        UPDATE public.chat_groups SET updated_at = now() - interval '3 hours' WHERE id = ${named.id}
      `);
        await unfriend(tx, viewer, owner);
        if (ending === 'block') {
          await tx
            .insert(schema.userBlocks)
            .values({ blockerId: viewer, blockedId: owner });
        }
        const gap = await shareMeal(tx, owner);
        await tx.execute(
          sql`DELETE FROM public.user_blocks WHERE blocker_id = ${viewer}`
        );
        await befriend(tx, viewer, owner);
        expect(await getOrCreateDirectChatGroup(viewer, owner, tx)).toEqual(
          direct
        );

        // Stale direct memberships cannot substitute for the new friend-since
        // boundary, even when a named group admits the same share.
        expect(
          (await listGroupMealFeed(viewer, { groupId: direct.id }, tx)).entries
        ).toEqual([]);
        expect(await newestGroupSharedAt(direct.id, viewer, tx)).toBeNull();
        const groups = await listMyChatGroups(
          viewer,
          { timezoneOffset: 0 },
          tx
        );
        expect(groups.find((group) => group.id === direct.id)).toMatchObject({
          unread: false,
          lastMealSharedAt: null,
        });
        // A named group still admits non-friend shares by membership since join.
        // Its presence also catches an uncorrelated inner chat_groups alias.
        expect(groups[0].id).toBe(named.id);
        expect(groups.find((group) => group.id === named.id)).toMatchObject({
          unread: true,
          lastMealSharedAt: gap.sharedAt.toISOString(),
        });
        await unfriend(tx, viewer, owner);
        expect(
          (
            await listGroupMealFeed(viewer, { groupId: named.id }, tx)
          ).entries.map((entry) => entry.meal.shareId)
        ).toEqual([gap.id]);

        await tx.execute(
          sql`DELETE FROM public.chat_group_members WHERE group_id = ${named.id}`
        );
        expect(await canViewShare(viewer, gap.id, tx)).toBe(false);
        await befriend(tx, viewer, owner);
        const current = await shareMeal(tx, owner);
        expect(
          (
            await listGroupMealFeed(viewer, { groupId: direct.id }, tx)
          ).entries.map((entry) => entry.meal.shareId)
        ).toEqual([current.id]);
        expect(await newestGroupSharedAt(direct.id, viewer, tx)).toEqual(
          current.sharedAt
        );
        expect(await canViewShare(viewer, current.id, tx)).toBe(true);
      });
    });

    it('keeps the viewer’s own non-private shares visible in a direct chat', async () => {
      await withPair(async (tx, viewer, owner) => {
        const group = await getOrCreateDirectChatGroup(viewer, owner, tx);
        const own = await shareMeal(tx, viewer);
        await unfriend(tx, viewer, owner);
        await befriend(tx, viewer, owner);
        expect(
          (
            await listGroupMealFeed(viewer, { groupId: group.id }, tx)
          ).entries.map((entry) => entry.meal.shareId)
        ).toEqual([own.id]);
      });
    });
  }
);
