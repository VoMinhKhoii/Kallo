// Friendship service functions. SECURITY: the Drizzle db handle bypasses RLS —
// every query must carry an explicit actor predicate (see ./types.ts).

import { and, eq, sql } from 'drizzle-orm';
import { getOrCreateDirectChatGroup } from '@/lib/actions/chat-groups/direct-chats';
import { Errors } from '@/lib/core/errors/catalog';
import {
  acceptInviteSchema,
  removeFriendSchema,
} from '@/lib/core/validation/social';
import { friendJoinedKey } from '@/lib/domain/notifications/group-keys';
import {
  type ScopedNotify,
  withNotifications,
} from '@/lib/domain/notifications/with-notifications';
import { orderedPair } from '@/lib/domain/social/friendship';
import {
  isBlockedPair,
  lockPairSql,
} from '@/lib/domain/social/moderation/blocks';
import { assertFriendCapacity } from '@/lib/domain/social/quota/circle-quota';
import { db as defaultDb } from '@/lib/infra/db/client';
import { circleEvents, friendships } from '@/lib/infra/db/schema';

import { getOrCreateMyProfile, getProfileBySlug } from './profile';
import type { Db, PublicProfile } from './types';

// ---------------------------------------------------------------------------
// acceptInvite — the recipient taps Accept on a link; connect directly
// ---------------------------------------------------------------------------
// The recipient's tap IS the accept (Locket model): no separate inviter
// approval. Creates an accepted edge, or promotes a pre-existing pending one.
// The friendships_set_accepted_at trigger stamps accepted_at at that status
// flip (database clock, so it compares cleanly with meal_shares.shared_at) —
// each side then sees only the other's shares made from that moment on, never
// the history from before they connected. The app never writes the column.
// The friendship write + event + direct chat group are all transactional so
// none of the three can end up orphaned relative to the others. A pair whose
// edge was already accepted before this call (the early return below) is
// assumed to already have its chat — legacy edges accepted before this
// backfill existed are instead picked up lazily by
// ensureDirectChatsForAcceptedFriends() on the next chat-list read.

export async function acceptInvite(
  actorId: string,
  input: { slug: string },
  db: Db = defaultDb
): Promise<{ status: 'accepted'; inviter: PublicProfile }> {
  const parsed = acceptInviteSchema.parse(input);

  const inviter = await getProfileBySlug(parsed.slug, db);
  if (!inviter) {
    throw Errors.notFound('Liên kết mời không hợp lệ.');
  }
  if (inviter.userId === actorId) {
    throw Errors.validationFailed('Không thể kết nối với chính mình.');
  }

  // Provision the recipient's own link profile so they carry a circle label in
  // the inviter's circle even if they accept before ever opening their own
  // Groups page. Idempotent — returns the existing profile when one exists.
  await getOrCreateMyProfile(actorId, null, db);

  const { userLow, userHigh } = orderedPair(actorId, inviter.userId);

  // The wrapper drains the queued push only after the transaction commits, so
  // it can never fire for a friendship that rolled back.
  return withNotifications(db, async (tx, notify) => {
    // The pair lock blockFriend also takes: a block committing between the
    // check below and the friendship write would otherwise leave the pair
    // friends despite the block (there may be no row yet to lock).
    await tx.execute(lockPairSql(userLow, userHigh));
    if (await isBlockedPair(tx, actorId, inviter.userId)) {
      throw Errors.conflict('Không thể kết nối.');
    }

    // Lock the canonical edge row for the duration of the transaction so a
    // concurrent writer can't interleave between this read and the promote.
    const existing = await tx
      .select({ id: friendships.id, status: friendships.status })
      .from(friendships)
      .where(
        and(
          eq(friendships.userLow, userLow),
          eq(friendships.userHigh, userHigh)
        )
      )
      .limit(1)
      .for('update');

    // Retired status (blocks live in user_blocks): a 'blocked' edge can only
    // be a leftover from the revision serving while the migration applied. It
    // is honoured as a block rather than promoted.
    if (existing[0]?.status === 'blocked') {
      throw Errors.conflict('Không thể kết nối.');
    }
    if (existing[0]?.status === 'accepted') {
      return { status: 'accepted' as const, inviter };
    }

    // Only a NEW accepted edge consumes free-tier friend quota — the
    // already-accepted return above is the grandfather path and never gets
    // here. Both parties are checked (see circle-quota: accepter → 402,
    // inviter → 409).
    await assertFriendCapacity(tx, {
      accepterId: actorId,
      inviterId: inviter.userId,
      inviterName: inviter.displayName?.trim() || inviter.handle,
    });

    if (existing[0]) {
      // Promote a pending edge (either direction) to accepted. The row is
      // locked above; the status guard is defence-in-depth. The trigger stamps
      // accepted_at on this flip.
      await tx
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(
          and(
            eq(friendships.id, existing[0].id),
            sql`${friendships.status} <> 'blocked'`
          )
        );
      await tx.insert(circleEvents).values({
        actorId,
        type: 'friend_accepted',
        refId: existing[0].id,
      });
      await notifyInviterOfJoin(
        notify,
        actorId,
        inviter.userId,
        existing[0].id
      );
    } else {
      // No edge yet. The locked read can't lock a row that doesn't exist, so
      // a racing accept/block may insert first; swallow the unique violation
      // and reconcile instead of surfacing a spurious 500 on this core action.
      const inserted = await tx
        .insert(friendships)
        .values({
          userLow,
          userHigh,
          // The inviter initiated by sharing the link; the recipient accepted.
          requestedBy: inviter.userId,
          status: 'accepted',
        })
        .onConflictDoNothing({
          target: [friendships.userLow, friendships.userHigh],
        })
        .returning({ id: friendships.id });

      if (inserted[0]) {
        await tx.insert(circleEvents).values({
          actorId,
          type: 'friend_accepted',
          refId: inserted[0].id,
        });
        await notifyInviterOfJoin(
          notify,
          actorId,
          inviter.userId,
          inserted[0].id
        );
      } else {
        // A concurrent writer won the insert — re-read and honour a block.
        const reconciled = await tx
          .select({ status: friendships.status })
          .from(friendships)
          .where(
            and(
              eq(friendships.userLow, userLow),
              eq(friendships.userHigh, userHigh)
            )
          )
          .limit(1);
        if (reconciled[0]?.status === 'blocked') {
          throw Errors.conflict('Không thể kết nối.');
        }
      }
    }

    // Every path that reaches here just (re)established an accepted edge —
    // the ‘already accepted’ case above returns earlier and skips this.
    // Idempotent, so re-running it on retries is harmless.
    await getOrCreateDirectChatGroup(actorId, inviter.userId, tx);

    return { status: 'accepted' as const, inviter };
  });
}

// Tell the inviter their link landed — the one signal the Locket-style
// instant-connect flow would otherwise swallow. Called only on the two paths
// that actually establish the accepted edge; the race-reconcile path stays
// silent because the concurrent writer that won the insert already notified —
// and, having queued nothing, it pushes nothing.
function notifyInviterOfJoin(
  notify: ScopedNotify,
  actorId: string,
  inviterId: string,
  friendshipId: string
): Promise<void> {
  return notify([
    {
      recipientId: inviterId,
      type: 'friend.joined',
      actorId,
      objectType: 'friendship',
      objectId: friendshipId,
      groupKey: friendJoinedKey(friendshipId),
    },
  ]);
}

// ---------------------------------------------------------------------------
// removeFriend — drop a connection (re-invitable later)
// ---------------------------------------------------------------------------
// Deletes the canonical edge so the pair can reconnect via a new invite. Blocks
// live in user_blocks and are untouched; a leftover 'blocked' edge (the retired
// status, see acceptInvite) is still never cleared by a remove.

export async function removeFriend(
  actorId: string,
  input: { targetUserId: string },
  db: Db = defaultDb
): Promise<{ removed: boolean }> {
  const parsed = removeFriendSchema.parse(input);
  if (parsed.targetUserId === actorId) {
    throw Errors.validationFailed('Không thể xoá chính mình.');
  }

  const { userLow, userHigh } = orderedPair(actorId, parsed.targetUserId);

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.userLow, userLow),
        eq(friendships.userHigh, userHigh),
        sql`${friendships.status} <> 'blocked'`
      )
    );

  return { removed: true };
}

// ---------------------------------------------------------------------------
// getFriendshipStatus — the actor's edge status with another user, or null
// ---------------------------------------------------------------------------

export async function getFriendshipStatus(
  actorId: string,
  otherUserId: string,
  db: Db = defaultDb
): Promise<string | null> {
  // A block in either direction reads as 'blocked' — callers (the invite
  // preview route and page) answer it exactly like an invalid link.
  if (await isBlockedPair(db, actorId, otherUserId)) return 'blocked';
  const { userLow, userHigh } = orderedPair(actorId, otherUserId);
  const rows = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh))
    )
    .limit(1);
  return rows[0]?.status ?? null;
}
