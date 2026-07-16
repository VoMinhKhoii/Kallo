// ---------------------------------------------------------------------------
// Chat groups — unified 1:1 + group messaging service functions
// ---------------------------------------------------------------------------
// One chat concept: a group is N >= 2 members. 'direct' (2-person) chats are
// auto-created by acceptInvite() in lib/actions/groups.ts whenever a
// friendship is accepted — passing its own `tx` into getOrCreateDirectChatGroup
// so the friendship write and the chat creation commit or roll back together;
// 'group' chats are user-created from a multi-select of the actor's existing
// accepted friends — there is no invite-link path for chat groups. Pure,
// dependency-light functions (actorId + optional `db`) so the REST routes and
// tests can call them directly.
//
// NOTE: this file intentionally does NOT import from lib/actions/groups.ts —
// it queries `friendships` directly for its own friend-check (via the same
// `orderedPair()` canonical-ordering helper friendships already uses) so that
// groups.ts can import getOrCreateDirectChatGroup from here without a
// circular module dependency.
//
// The Drizzle `db` handle connects via DATABASE_URL as the owner role and
// BYPASSES RLS — every query below carries an explicit membership/ownership
// predicate as the PRIMARY authorization control, not defense-in-depth.

import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import type { AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  friendships,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { orderedPair } from '@/lib/groups/friendship';
import {
  type SharedMealEntry,
  sharedMealsBefore,
  todayLocalDate,
  toSharedMealEntry,
} from '@/lib/groups/meal-feed';
import {
  circleFeedSchema,
  createChatGroupSchema,
  groupMealFeedSchema,
  sendChatGroupMessageSchema,
} from '@/lib/validation';

// Accepts the app db singleton OR a transaction handle, so a caller already
// inside its own `db.transaction` (e.g. acceptInvite in lib/actions/groups.ts)
// can pass its `tx` through and get one atomic write instead of two.
type Db = typeof defaultDb | AppTransaction;

/** Most-recent messages loaded per thread open — no cursor yet (deferred). */
const MESSAGE_PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface ChatGroupIdentity {
  id: string;
  kind: 'direct' | 'group';
  /** Display title: the group name, or the other member's label for direct. */
  title: string;
  avatarSeed: string | null;
  updatedAt: string;
  /** Most recent message's text (raw, untruncated — the UI clips it). */
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  /** True when the most recent message OR shared meal postdates this actor's
   * read marker (bumped when the thread's feed is opened — see
   * listGroupMealFeed). */
  unread: boolean;
  /** Most recent shared-meal timestamp among this chat's members, today —
   * null when no member has shared a meal yet today. Drives the row's
   * "New food log · Xm ago" subtitle in place of a real chat preview until
   * text messaging has a UI. */
  lastMealSharedAt: string | null;
}

export interface ChatGroupMember {
  userId: string;
  role: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
}

export interface ChatGroupDetail {
  id: string;
  kind: 'direct' | 'group';
  name: string | null;
  members: ChatGroupMember[];
}

export interface ChatGroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type GroupMealFeedEntry = SharedMealEntry;

export interface GroupMealFeedPage {
  entries: GroupMealFeedEntry[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// isAcceptedFriend — private friend-check (queries friendships directly)
// ---------------------------------------------------------------------------

async function isAcceptedFriend(
  actorId: string,
  targetUserId: string,
  db: Db
): Promise<boolean> {
  const { userLow, userHigh } = orderedPair(actorId, targetUserId);
  const rows = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh))
    )
    .limit(1);
  return rows[0]?.status === 'accepted';
}

// ---------------------------------------------------------------------------
// requireMembership — throws notFound (never leaks existence) if not a member
// ---------------------------------------------------------------------------
// For DIRECT chats, membership alone is not enough: removing or blocking a
// friend only mutates `friendships`, so the stale membership rows would keep
// authorizing an ex/blocked friend to read shared meals and send messages.
// Direct-chat operations therefore also require a CURRENT accepted friendship
// between the pair (rows are kept so history survives a re-friend).

async function requireMembership(
  actorId: string,
  groupId: string,
  db: Db
): Promise<void> {
  const rows = await db
    .select({
      id: chatGroupMembers.id,
      kind: chatGroups.kind,
      directUserLow: chatGroups.directUserLow,
      directUserHigh: chatGroups.directUserHigh,
    })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMembers.groupId))
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, actorId)
      )
    )
    .limit(1);
  if (!rows[0]) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }
  const row = rows[0];
  if (row.kind === 'direct' && row.directUserLow && row.directUserHigh) {
    const otherUserId =
      row.directUserLow === actorId ? row.directUserHigh : row.directUserLow;
    const stillFriends = await isAcceptedFriend(actorId, otherUserId, db);
    if (!stillFriends) {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }
  }
}

// ---------------------------------------------------------------------------
// getOrCreateDirectChatGroup — idempotent per canonical friend pair
// ---------------------------------------------------------------------------

export async function getOrCreateDirectChatGroup(
  userA: string,
  userB: string,
  db: Db = defaultDb
): Promise<{ id: string }> {
  const { userLow, userHigh } = orderedPair(userA, userB);

  await db
    .insert(chatGroups)
    .values({
      kind: 'direct',
      createdBy: userA,
      directUserLow: userLow,
      directUserHigh: userHigh,
    })
    .onConflictDoNothing({
      target: [chatGroups.directUserLow, chatGroups.directUserHigh],
    });

  const [group] = await db
    .select({ id: chatGroups.id })
    .from(chatGroups)
    .where(
      and(
        eq(chatGroups.directUserLow, userLow),
        eq(chatGroups.directUserHigh, userHigh)
      )
    )
    .limit(1);

  // Ensure both membership rows exist (idempotent — a pre-existing chat may
  // already have one or both from a prior call).
  await db
    .insert(chatGroupMembers)
    .values([
      { groupId: group.id, userId: userLow, role: 'member' },
      { groupId: group.id, userId: userHigh, role: 'member' },
    ])
    .onConflictDoNothing({
      target: [chatGroupMembers.groupId, chatGroupMembers.userId],
    });

  return { id: group.id };
}

// ---------------------------------------------------------------------------
// createChatGroup — user-created named group from existing friends
// ---------------------------------------------------------------------------

export async function createChatGroup(
  actorId: string,
  input: { name: string; memberUserIds: string[] },
  db: Db = defaultDb
): Promise<{ id: string }> {
  const parsed = createChatGroupSchema.parse(input);

  const memberIds = [...new Set(parsed.memberUserIds)].filter(
    (id) => id !== actorId
  );
  if (memberIds.length === 0) {
    throw Errors.validationFailed('Chọn ít nhất một thành viên.');
  }

  const acceptedChecks = await Promise.all(
    memberIds.map((memberId) => isAcceptedFriend(actorId, memberId, db))
  );
  if (acceptedChecks.some((accepted) => !accepted)) {
    throw Errors.validationFailed(
      'Chỉ có thể thêm bạn bè đã kết nối vào nhóm.'
    );
  }

  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(chatGroups)
      .values({ kind: 'group', name: parsed.name, createdBy: actorId })
      .returning({ id: chatGroups.id });

    await tx.insert(chatGroupMembers).values([
      { groupId: group.id, userId: actorId, role: 'owner' },
      ...memberIds.map((userId) => ({
        groupId: group.id,
        userId,
        role: 'member' as const,
      })),
    ]);

    return { id: group.id };
  });
}

// ---------------------------------------------------------------------------
// ensureDirectChatsForAcceptedFriends — self-healing backfill
// ---------------------------------------------------------------------------
// getOrCreateDirectChatGroup only runs inside acceptInvite, so a friendship
// accepted before this feature shipped (or on a pair whose acceptInvite path
// hasn't been hit again) would otherwise never get a direct chat. Called
// before every list read so a friend always shows up here, regardless of
// when the friendship was formed. Idempotent + parallel — cheap for a
// circle-sized friend list.

async function ensureDirectChatsForAcceptedFriends(
  actorId: string,
  db: Db
): Promise<void> {
  const friendRows = await db
    .select({ userLow: friendships.userLow, userHigh: friendships.userHigh })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.userLow, actorId), eq(friendships.userHigh, actorId)),
        eq(friendships.status, 'accepted')
      )
    );

  const friendIds = friendRows.map((r) =>
    r.userLow === actorId ? r.userHigh : r.userLow
  );
  if (friendIds.length === 0) return;

  await Promise.all(
    friendIds.map((friendId) =>
      getOrCreateDirectChatGroup(actorId, friendId, db)
    )
  );
}

// ---------------------------------------------------------------------------
// listMyChatGroups — every chat the actor belongs to, most-recent first
// ---------------------------------------------------------------------------

export async function listMyChatGroups(
  actorId: string,
  input: { timezoneOffset: number },
  db: Db = defaultDb
): Promise<ChatGroupIdentity[]> {
  const { timezoneOffset } = circleFeedSchema.parse(input);
  await ensureDirectChatsForAcceptedFriends(actorId, db);

  const myGroups = await db
    .select({
      id: chatGroups.id,
      kind: chatGroups.kind,
      name: chatGroups.name,
      avatarSeed: chatGroups.avatarSeed,
      updatedAt: chatGroups.updatedAt,
      lastReadAt: chatGroupMembers.lastReadAt,
    })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMembers.groupId))
    .where(eq(chatGroupMembers.userId, actorId))
    .orderBy(desc(chatGroups.updatedAt));

  const groupIds = myGroups.map((g) => g.id);
  const directGroupIds = myGroups
    .filter((g) => g.kind === 'direct')
    .map((g) => g.id);

  const today = todayLocalDate(timezoneOffset);
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    today,
    timezoneOffset
  );

  // Resolve the OTHER member's identity for every direct chat, the most
  // recent message per chat (any kind), and each chat's most recent shared
  // meal today (any member), in parallel — independent queries.
  const [otherMembers, lastMessages, lastMealShares] = await Promise.all([
    directGroupIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            groupId: chatGroupMembers.groupId,
            handle: publicProfiles.handle,
            displayName: publicProfiles.displayName,
            avatarSeed: publicProfiles.avatarSeed,
          })
          .from(chatGroupMembers)
          .innerJoin(
            publicProfiles,
            eq(publicProfiles.userId, chatGroupMembers.userId)
          )
          .where(
            and(
              inArray(chatGroupMembers.groupId, directGroupIds),
              sql`${chatGroupMembers.userId} <> ${actorId}`
            )
          ),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .selectDistinctOn([chatGroupMessages.groupId], {
            groupId: chatGroupMessages.groupId,
            body: chatGroupMessages.body,
            createdAt: chatGroupMessages.createdAt,
          })
          .from(chatGroupMessages)
          .where(inArray(chatGroupMessages.groupId, groupIds))
          // DISTINCT ON requires the leading ORDER BY to match the distinct key.
          .orderBy(
            chatGroupMessages.groupId,
            desc(chatGroupMessages.createdAt)
          ),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            groupId: chatGroupMembers.groupId,
            lastSharedAt: sql<Date>`max(${mealShares.sharedAt})`,
          })
          .from(chatGroupMembers)
          .innerJoin(meals, eq(meals.userId, chatGroupMembers.userId))
          .innerJoin(mealShares, eq(mealShares.mealId, meals.id))
          .where(
            and(
              inArray(chatGroupMembers.groupId, groupIds),
              sql`${mealShares.visibility} <> 'private'`,
              gte(mealShares.sharedAt, dayStart),
              lt(mealShares.sharedAt, dayEnd)
            )
          )
          .groupBy(chatGroupMembers.groupId),
  ]);

  const otherByGroupId = new Map(otherMembers.map((m) => [m.groupId, m]));
  const lastMessageByGroupId = new Map(lastMessages.map((m) => [m.groupId, m]));
  // `sql<Date>` on a raw MAX(...) aggregate is only a type hint — drizzle
  // doesn't actually coerce the driver's return value, which comes back as a
  // string, not a Date. Normalize here, once, so every consumer below can
  // trust `Date` methods without re-wrapping at each call site.
  const lastMealSharedAtByGroupId = new Map(
    lastMealShares.map((m) => [m.groupId, new Date(m.lastSharedAt)])
  );

  const identities = myGroups.map((g) => {
    const lastMessage = lastMessageByGroupId.get(g.id) ?? null;
    const lastMealSharedAt = lastMealSharedAtByGroupId.get(g.id) ?? null;
    const messageUnread = lastMessage
      ? lastMessage.createdAt > g.lastReadAt
      : false;
    const mealUnread = lastMealSharedAt
      ? lastMealSharedAt > g.lastReadAt
      : false;
    const shared = {
      avatarSeed: g.avatarSeed,
      updatedAt: g.updatedAt.toISOString(),
      lastMessagePreview: lastMessage?.body ?? null,
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      unread: messageUnread || mealUnread,
      lastMealSharedAt: lastMealSharedAt
        ? lastMealSharedAt.toISOString()
        : null,
      // Ranked by the more-recent of "a message was sent" or "a member
      // shared a meal" — chatGroups.updatedAt alone misses meal activity,
      // since only sendChatGroupMessage bumps it.
      activityRank: Math.max(
        g.updatedAt.getTime(),
        lastMealSharedAt?.getTime() ?? 0
      ),
    };

    if (g.kind === 'group') {
      return {
        id: g.id,
        kind: 'group' as const,
        title: g.name ?? '',
        ...shared,
      };
    }
    const other = otherByGroupId.get(g.id);
    const title = other?.displayName?.trim() || other?.handle || '';
    return {
      id: g.id,
      kind: 'direct' as const,
      title,
      ...shared,
      avatarSeed: other?.avatarSeed ?? null,
    };
  });

  return identities
    .sort((a, b) => b.activityRank - a.activityRank)
    .map(({ activityRank: _activityRank, ...identity }) => identity);
}

// ---------------------------------------------------------------------------
// getChatGroup — detail + member list (membership-gated)
// ---------------------------------------------------------------------------

export async function getChatGroup(
  actorId: string,
  input: { groupId: string },
  db: Db = defaultDb
): Promise<ChatGroupDetail> {
  await requireMembership(actorId, input.groupId, db);

  const [group] = await db
    .select({ id: chatGroups.id, kind: chatGroups.kind, name: chatGroups.name })
    .from(chatGroups)
    .where(eq(chatGroups.id, input.groupId))
    .limit(1);
  if (!group) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }

  const memberRows = await db
    .select({
      userId: chatGroupMembers.userId,
      role: chatGroupMembers.role,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(chatGroupMembers)
    .innerJoin(
      publicProfiles,
      eq(publicProfiles.userId, chatGroupMembers.userId)
    )
    .where(eq(chatGroupMembers.groupId, input.groupId));

  return {
    id: group.id,
    kind: group.kind as 'direct' | 'group',
    name: group.name,
    members: memberRows,
  };
}

// ---------------------------------------------------------------------------
// listGroupMealFeed — this group's shared-meal history, paginated
// ---------------------------------------------------------------------------
// The group-thread counterpart to listFriendsThreadFeed (lib/actions/groups.ts):
// every shared meal among the group's members, seek-paginated oldest-ward via
// `before`, no cap. A fellow member need not be the viewer's own accepted
// friend — being in the same group is its own visibility boundary,
// membership-gated the same way every other chat-groups read is.

export async function listGroupMealFeed(
  actorId: string,
  input: { groupId: string; before?: string },
  db: Db = defaultDb
): Promise<GroupMealFeedPage> {
  const parsed = groupMealFeedSchema.parse(input);
  await requireMembership(actorId, parsed.groupId, db);

  const memberRows = await db
    .select({ userId: chatGroupMembers.userId })
    .from(chatGroupMembers)
    .where(eq(chatGroupMembers.groupId, parsed.groupId));
  const memberIds = memberRows.map((r) => r.userId);

  const before = parsed.before ? new Date(parsed.before) : null;

  // Opening the thread IS the read receipt (page 1 only — not every "load
  // older" scroll fetch) — same pattern as listChatGroupMessages, just keyed
  // off the meal feed since that's what the UI actually surfaces.
  const [{ rows, nextCursor }] = await Promise.all([
    sharedMealsBefore(memberIds, before, db),
    parsed.before
      ? Promise.resolve(undefined)
      : db
          .update(chatGroupMembers)
          .set({ lastReadAt: new Date() })
          .where(
            and(
              eq(chatGroupMembers.groupId, parsed.groupId),
              eq(chatGroupMembers.userId, actorId)
            )
          ),
  ]);

  return {
    entries: rows.map((r) => toSharedMealEntry(r, actorId)),
    nextCursor,
  };
}

// ---------------------------------------------------------------------------
// listChatGroupMessages — most-recent page, oldest-first for rendering
// ---------------------------------------------------------------------------

export async function listChatGroupMessages(
  actorId: string,
  input: { groupId: string },
  db: Db = defaultDb
): Promise<ChatGroupMessage[]> {
  await requireMembership(actorId, input.groupId, db);

  // Opening the thread IS the read receipt — bump the actor's own marker so
  // this chat drops out of "unread" on the list. Independent of the message
  // fetch below, so run them in parallel.
  const [rows] = await Promise.all([
    db
      .select({
        id: chatGroupMessages.id,
        groupId: chatGroupMessages.groupId,
        senderId: chatGroupMessages.senderId,
        body: chatGroupMessages.body,
        createdAt: chatGroupMessages.createdAt,
      })
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.groupId, input.groupId))
      .orderBy(desc(chatGroupMessages.createdAt))
      .limit(MESSAGE_PAGE_SIZE),
    db
      .update(chatGroupMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatGroupMembers.groupId, input.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      ),
  ]);

  return rows.reverse().map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// sendChatGroupMessage
// ---------------------------------------------------------------------------

export async function sendChatGroupMessage(
  actorId: string,
  input: { groupId: string; body: string },
  db: Db = defaultDb
): Promise<ChatGroupMessage> {
  const parsed = sendChatGroupMessageSchema.parse(input);
  await requireMembership(actorId, parsed.groupId, db);

  const [row] = await db
    .insert(chatGroupMessages)
    .values({
      groupId: parsed.groupId,
      senderId: actorId,
      body: parsed.body,
    })
    .returning();

  // Bump the group's activity timestamp so the chat list (ordered by it)
  // sorts by most-recent-activity, not creation time.
  await db
    .update(chatGroups)
    .set({ updatedAt: new Date() })
    .where(eq(chatGroups.id, parsed.groupId));

  return { ...row, createdAt: row.createdAt.toISOString() };
}
