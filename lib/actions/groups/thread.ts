// The per-post thread page's read. SECURITY: the Drizzle db handle bypasses
// RLS — admission lives inside sharedMealVisibleToActor, which delegates to
// canViewShare, the one gate every cross-user share read goes through.

import { shareThreadSchema } from '@/lib/core/validation/social';
import {
  type SharedMealEntry,
  toSharedMealEntry,
} from '@/lib/domain/social/feed/meal-feed';
import { sharedMealVisibleToActor } from '@/lib/domain/social/feed/share-lookup';
import { reactionsForShares } from '@/lib/domain/social/shares/reactions';
import { repliesForShares } from '@/lib/domain/social/shares/replies';
import { db as defaultDb } from '@/lib/infra/db/client';

import type { Db } from './types';

/**
 * One shared meal as its own entry — the same shape (and the same reaction /
 * reply enrichment) the feeds build, so `/circle/<shareId>` renders the post
 * with the very component the feed uses.
 *
 * Returns null rather than throwing when the share is gone or not the actor's
 * to see: the two are indistinguishable to a viewer by design, and the page
 * shows one "isn't here any more" state for both.
 *
 * Unlike listFriendsThreadFeed this has NO read-marker side effect — opening a
 * single post from a notification must not mark the whole Friends feed read.
 */
export async function getSharedMealEntry(
  actorId: string,
  shareId: string,
  db: Db = defaultDb
): Promise<SharedMealEntry | null> {
  // A malformed id is a share that does not exist; the page owes the reader the
  // gone state, not a retry.
  const parsed = shareThreadSchema.safeParse({ shareId });
  if (!parsed.success) return null;

  const row = await sharedMealVisibleToActor(actorId, parsed.data.shareId, db);
  if (!row) return null;

  const [reactions, replies] = await Promise.all([
    reactionsForShares(actorId, [row.shareId], db),
    repliesForShares(actorId, [row.shareId], db),
  ]);

  return toSharedMealEntry(
    row,
    actorId,
    reactions.get(row.shareId),
    replies.get(row.shareId)
  );
}
