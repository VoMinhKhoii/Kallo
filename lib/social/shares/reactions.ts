// ---------------------------------------------------------------------------
// Meal-share reaction enrichment
// ---------------------------------------------------------------------------
// Callers supply share ids they already authorized through their feed scope;
// this module batches counts and the viewer's own state without re-reading the
// underlying meals.

import { inArray, sql } from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import { mealShareReactions } from '@/lib/db/schema';

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
    .where(inArray(mealShareReactions.shareId, ids))
    .groupBy(mealShareReactions.shareId);

  for (const row of rows) {
    summaries.set(row.shareId, {
      count: Number(row.count),
      mine: Boolean(row.mine),
    });
  }
  return summaries;
}
