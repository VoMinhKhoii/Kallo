// ---------------------------------------------------------------------------
// One shared meal, by id, subject to the canonical share-visibility gate
// ---------------------------------------------------------------------------
// The per-post thread page (/circle/<shareId>) reads a single share rather than
// a page of them, and a link must never become a way around the rules the feeds
// apply. Admission is therefore NOT decided here: it is `canViewShare`, the one
// gate every cross-user share read goes through (owner short-circuit,
// non-private, then an accepted friendship or a named-group membership that
// predates the share for both people).
//
// This file used to restate those predicates as its own EXISTS clauses, and the
// copy drifted: its shared-group EXISTS matched ANY chat group, with no
// `chat_groups.kind = 'group'` filter. removeFriend and blockFriend delete the
// friendship edge but leave the pair's direct-chat `chat_group_members` rows in
// place (lib/actions/groups/friendship.ts, lib/actions/chat-groups/membership.ts),
// so those stale rows are a permanent shared "group" — and a viewer who had been
// unfriended or blocked could still open any share of theirs by id. A second
// copy of an authorization rule is a second thing to keep correct; there is now
// only the one.
//
// Cost: two round trips (gate, then row) for a single-post page. Accepted.

import { and, eq, sql } from 'drizzle-orm';
import {
  type SharedMealRow,
  sharedMealColumns,
} from '@/lib/domain/social/feed/meal-feed';
import { canViewShare } from '@/lib/domain/social/shares/share-visibility';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import { mealShares, meals, publicProfiles } from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

/**
 * The share `shareId` as the feeds would render it, or null when the actor may
 * not see it — deleted, private, or shared into a circle/group they are not
 * part of. The refusal happens before the row is read, so an inadmissible meal
 * never leaves the database. Never advances a read marker: opening one post is
 * not "I have seen the feed" (see listFriendsThreadFeed, which deliberately
 * does).
 */
export async function sharedMealVisibleToActor(
  actorId: string,
  shareId: string,
  db: Db = defaultDb
): Promise<SharedMealRow | null> {
  if (!(await canViewShare(actorId, shareId, db))) return null;

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
        // The feeds never render a private share, not even the owner's own —
        // the gate admits the owner, this keeps the page in step with the feed.
        sql`${mealShares.visibility} <> 'private'`
      )
    )
    .limit(1);

  return row ?? null;
}
