// ---------------------------------------------------------------------------
// Meal-share reply enrichment
// ---------------------------------------------------------------------------

import { asc, eq, inArray, lte, sql } from 'drizzle-orm';
import {
  type PublicIdentity,
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/domain/social/identity/public-identity';
import type { AppDb, AppTransaction } from '@/lib/infra/db';
import { db as defaultDb } from '@/lib/infra/db';
import { mealShareReplies, publicProfiles } from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

const REPLIES_PER_SHARE = 12;

export interface ShareReply {
  id: string;
  author: PublicIdentity;
  isSelf: boolean;
  body: string;
  createdAt: string;
}

export interface ShareRepliesSummary {
  replies: ShareReply[];
  total: number;
}

/** Return each share's newest 12 replies, displayed oldest-first within that
 * bounded slice, plus the total reply count from the same windowed scan. */
export async function repliesForShares(
  actorId: string,
  shareIds: string[],
  db: Db = defaultDb
): Promise<Map<string, ShareRepliesSummary>> {
  const ids = [...new Set(shareIds)];
  const byShare = new Map<string, ShareRepliesSummary>(
    ids.map((id) => [id, { replies: [], total: 0 }])
  );
  if (ids.length === 0) return byShare;

  const rankedReplies = db
    .select({
      id: mealShareReplies.id,
      shareId: mealShareReplies.shareId,
      userId: mealShareReplies.userId,
      body: mealShareReplies.body,
      createdAt: mealShareReplies.createdAt,
      rank: sql<number>`row_number() OVER (
        PARTITION BY ${mealShareReplies.shareId}
        ORDER BY ${mealShareReplies.createdAt} DESC, ${mealShareReplies.id} DESC
      )::int`.as('reply_rank'),
      total: sql<number>`count(*) OVER (
        PARTITION BY ${mealShareReplies.shareId}
      )::int`.as('reply_total'),
    })
    .from(mealShareReplies)
    .where(inArray(mealShareReplies.shareId, ids))
    .as('ranked_share_replies');

  const rows = await db
    .select({
      id: rankedReplies.id,
      shareId: rankedReplies.shareId,
      userId: rankedReplies.userId,
      body: rankedReplies.body,
      createdAt: rankedReplies.createdAt,
      total: rankedReplies.total,
      ...publicProfileColumns,
    })
    .from(rankedReplies)
    .innerJoin(publicProfiles, eq(publicProfiles.userId, rankedReplies.userId))
    .where(lte(rankedReplies.rank, REPLIES_PER_SHARE))
    .orderBy(
      rankedReplies.shareId,
      asc(rankedReplies.createdAt),
      asc(rankedReplies.id)
    );

  for (const row of rows) {
    const summary = byShare.get(row.shareId);
    if (!summary) continue;
    summary.total = Number(row.total);
    summary.replies.push({
      id: row.id,
      author: toPublicIdentity(row),
      isSelf: row.userId === actorId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    });
  }
  return byShare;
}
