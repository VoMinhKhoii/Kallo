// ---------------------------------------------------------------------------
// One shared meal, by id, subject to the feeds' visibility policy
// ---------------------------------------------------------------------------
// The per-post thread page (/circle/<shareId>) reads a single share rather than
// a page of them, but it must be visible under exactly the rules the feeds
// already apply — otherwise a link would become a way around them. So the row
// projection comes from meal-feed's `sharedMealColumns`, and the two admission
// rules are the same two predicates the feed queries carry:
//
//   friends  — sharedMealsBefore: the actor's own share, or an accepted
//              friendship edge with the owner (either orientation).
//   groups   — sharedGroupMealsBefore: a chat group both are members of, with
//              the share posted after BOTH joined (the post-join bound).
//
// Written as EXISTS clauses instead of joins so a share visible through several
// groups still yields exactly one row.

import { and, eq, exists, gte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  type SharedMealRow,
  sharedMealColumns,
} from '@/lib/domain/social/feed/meal-feed';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  friendships,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

/**
 * The share `shareId` as the feeds would render it, or null when the actor may
 * not see it — deleted, private, or shared into a circle/group they are not
 * part of. Never advances a read marker: opening one post is not "I have seen
 * the feed" (see listFriendsThreadFeed, which deliberately does).
 */
export async function sharedMealVisibleToActor(
  actorId: string,
  shareId: string,
  db: Db = defaultDb
): Promise<SharedMealRow | null> {
  const ownerMembership = alias(chatGroupMembers, 'share_owner_membership');
  const viewerMembership = alias(chatGroupMembers, 'share_viewer_membership');

  const acceptedFriendship = exists(
    db
      .select({ one: sql`1` })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(
              eq(friendships.userLow, actorId),
              eq(friendships.userHigh, mealShares.actorId)
            ),
            and(
              eq(friendships.userHigh, actorId),
              eq(friendships.userLow, mealShares.actorId)
            )
          )
        )
      )
  );

  const sharedGroup = exists(
    db
      .select({ one: sql`1` })
      .from(viewerMembership)
      .innerJoin(
        ownerMembership,
        and(
          eq(ownerMembership.groupId, viewerMembership.groupId),
          eq(ownerMembership.userId, mealShares.actorId)
        )
      )
      .where(
        and(
          eq(viewerMembership.userId, actorId),
          gte(mealShares.sharedAt, viewerMembership.joinedAt),
          gte(mealShares.sharedAt, ownerMembership.joinedAt)
        )
      )
  );

  const [row] = await db
    .select(sharedMealColumns)
    .from(mealShares)
    .innerJoin(
      meals,
      and(eq(meals.id, mealShares.mealId), eq(meals.userId, mealShares.actorId))
    )
    .innerJoin(publicProfiles, eq(publicProfiles.userId, mealShares.actorId))
    .where(
      and(
        eq(mealShares.id, shareId),
        sql`${mealShares.visibility} <> 'private'`,
        or(eq(mealShares.actorId, actorId), acceptedFriendship, sharedGroup)
      )
    )
    .limit(1);

  return row ?? null;
}
