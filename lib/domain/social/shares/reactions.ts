// ---------------------------------------------------------------------------
// Meal-share reaction enrichment
// ---------------------------------------------------------------------------
// Callers supply share ids they already authorized through their feed scope;
// this module batches counts and the viewer's own state without re-reading the
// underlying meals.

import { and, inArray, sql } from 'drizzle-orm';
import { notBlockedWithSql } from '@/lib/domain/social/moderation/blocks';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import { mealShareReactions } from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

export interface ShareReactions {
  count: number;
  mine: boolean;
}

/**
 * Return a complete summary map for an already-authorized batch of shares.
 * Missing rows are materialized as zero/false so projections never need an
 * N+1 fallback query.
 */
export async function reactionsForShares(
  actorId: string,
  shareIds: string[],
  db: Db = defaultDb
): Promise<Map<string, ShareReactions>> {
  const ids = [...new Set(shareIds)];
  const summaries = new Map<string, ShareReactions>(
    ids.map((shareId) => [shareId, { count: 0, mine: false }])
  );
  if (ids.length === 0) return summaries;

  const rows = await db
    .select({
      shareId: mealShareReactions.shareId,
      count: sql<number>`count(*)::int`,
      mine: sql<boolean>`bool_or(${mealShareReactions.userId} = ${actorId})`,
    })
    .from(mealShareReactions)
    .where(
      and(
        inArray(mealShareReactions.shareId, ids),
        // A blocked person's hearts are not counted for the viewer, in either
        // direction of the block (the replies read applies the same rule).
        notBlockedWithSql(actorId, mealShareReactions.userId)
      )
    )
    .groupBy(mealShareReactions.shareId);

  for (const row of rows) {
    summaries.set(row.shareId, {
      count: Number(row.count),
      mine: Boolean(row.mine),
    });
  }
  return summaries;
}
