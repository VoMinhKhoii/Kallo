import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import {
  circleEvents,
  coachAssignments,
  friendsFeedReadMarkers,
  friendships,
  mealShareInvites,
  mealShareReactions,
  mealShareReplies,
  mealShares,
  publicProfiles,
} from '@/lib/infra/db/schema';

/**
 * The Circle: who the user is connected to and what they did there.
 *
 * Only the caller's own records are exported. About another person the export
 * carries the minimum that makes a record meaningful and that the user can
 * already see in the app — their user id and, for a friend, their public
 * handle. Reactions and replies other people left on the user's shares are
 * those people's content and stay out.
 *
 * Blocks live in user_blocks, which is not exported (see coverage.ts). A
 * friendships row can only still read 'blocked' as a leftover of the retired
 * status (schema.ts), and those stay out: the row does not record who blocked,
 * and the product never tells a blocked person they were blocked.
 */
export async function loadSocialExport(db: AppDb, userId: string) {
  const isMine = or(
    eq(friendships.userLow, userId),
    eq(friendships.userHigh, userId)
  );
  // The profile row of the OTHER end of each edge — handle only.
  const counterpartProfile = or(
    and(
      eq(friendships.userLow, userId),
      eq(publicProfiles.userId, friendships.userHigh)
    ),
    and(
      eq(friendships.userHigh, userId),
      eq(publicProfiles.userId, friendships.userLow)
    )
  );

  const [
    friendshipRows,
    shareRows,
    reactionRows,
    replyRows,
    inviteRows,
    eventRows,
    readMarkerRows,
    coachRows,
  ] = await Promise.all([
    db
      .select({
        id: friendships.id,
        friendUserId: sql<string>`CASE WHEN ${friendships.userLow} = ${userId}::uuid THEN ${friendships.userHigh} ELSE ${friendships.userLow} END`,
        friendHandle: publicProfiles.handle,
        status: friendships.status,
        requestedBy: friendships.requestedBy,
        // When the request was accepted: only meals shared after it are
        // visible across the edge (share-visibility.ts). Null while pending.
        acceptedAt: friendships.acceptedAt,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
      })
      .from(friendships)
      .leftJoin(publicProfiles, counterpartProfile)
      .where(and(isMine, ne(friendships.status, 'blocked'))),
    db
      .select({
        id: mealShares.id,
        mealId: mealShares.mealId,
        visibility: mealShares.visibility,
        sharedAt: mealShares.sharedAt,
      })
      .from(mealShares)
      .where(eq(mealShares.actorId, userId)),
    db
      .select({
        id: mealShareReactions.id,
        shareId: mealShareReactions.shareId,
        kind: mealShareReactions.kind,
        createdAt: mealShareReactions.createdAt,
      })
      .from(mealShareReactions)
      .where(eq(mealShareReactions.userId, userId)),
    db
      .select({
        id: mealShareReplies.id,
        shareId: mealShareReplies.shareId,
        body: mealShareReplies.body,
        createdAt: mealShareReplies.createdAt,
      })
      .from(mealShareReplies)
      .where(eq(mealShareReplies.userId, userId)),
    db
      .select()
      .from(mealShareInvites)
      .where(
        or(
          eq(mealShareInvites.fromUserId, userId),
          eq(mealShareInvites.toUserId, userId)
        )
      ),
    db
      .select({
        id: circleEvents.id,
        type: circleEvents.type,
        refId: circleEvents.refId,
        audience: circleEvents.audience,
        createdAt: circleEvents.createdAt,
      })
      .from(circleEvents)
      .where(eq(circleEvents.actorId, userId)),
    db
      .select({ lastReadAt: friendsFeedReadMarkers.lastReadAt })
      .from(friendsFeedReadMarkers)
      .where(eq(friendsFeedReadMarkers.userId, userId))
      .limit(1),
    db
      .select()
      .from(coachAssignments)
      .where(
        or(
          eq(coachAssignments.coachId, userId),
          eq(coachAssignments.clientId, userId)
        )
      ),
  ]);

  return {
    friendships: friendshipRows.map(({ requestedBy, ...row }) => ({
      ...row,
      requestedByMe: requestedBy === userId,
    })),
    mealShares: shareRows,
    reactions: reactionRows,
    replies: replyRows,
    mealShareInvites: inviteRows.map((row) => {
      const sent = row.fromUserId === userId;
      return {
        id: row.id,
        direction: sent ? ('sent' as const) : ('received' as const),
        counterpartUserId: sent ? row.toUserId : row.fromUserId,
        sourceMealId: row.sourceMealId,
        mode: row.mode,
        portionFactor: row.portionFactor,
        copyFactor: row.copyFactor,
        status: row.status,
        // On a sent offer this would be the recipient's diary row, not ours.
        acceptedMealId: sent ? null : row.acceptedMealId,
        createdAt: row.createdAt,
        respondedAt: row.respondedAt,
      };
    }),
    circleEvents: eventRows,
    feedLastReadAt: readMarkerRows[0]?.lastReadAt ?? null,
    coachAssignments: coachRows.map((row) => {
      const asCoach = row.coachId === userId;
      return {
        id: row.id,
        role: asCoach ? ('coach' as const) : ('client' as const),
        counterpartUserId: asCoach ? row.clientId : row.coachId,
        rank: row.rank,
        status: row.status,
        createdAt: row.createdAt,
      };
    }),
  };
}
