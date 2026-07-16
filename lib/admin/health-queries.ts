import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AppDb } from '@/lib/db';
import { pipelineRequests } from '@/lib/db/schema';
import { REPLAY_EXCLUSION } from './queries';

// ─── Filters schema ───────────────────────────────────────────────────────────

const _uuidSchema = z.string().uuid();

export interface HealthAggregates {
  successRate24h: number | null;
  successRate7d: number | null;
  successRate30d: number | null;
  p50_24h: number | null;
  p95_24h: number | null;
  p99_24h: number | null;
  requestsPerDay30d: { date: string; count: number }[];
  topErrors30d: { error: string; count: number }[];
}

export async function healthAggregates(db: AppDb): Promise<HealthAggregates> {
  // Replays are ALWAYS excluded from health aggregates
  const noReplays = REPLAY_EXCLUSION;

  const now = new Date();
  const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Single-row aggregate per rate window keeps SELECT/GROUP BY simple and
  // sidesteps Drizzle's qualified-column quirk in groupBy expressions.
  const rateSelect = {
    total: count(),
    successes: sql<number>`sum(case when ${pipelineRequests.status} = 'success' then 1 else 0 end)`,
  };

  const [rate24hRows, rate7dRows, rate30dRows, percentiles, perDay, errors] =
    await Promise.all([
      db
        .select(rateSelect)
        .from(pipelineRequests)
        .where(and(noReplays, gte(pipelineRequests.createdAt, minus24h))),
      db
        .select(rateSelect)
        .from(pipelineRequests)
        .where(and(noReplays, gte(pipelineRequests.createdAt, minus7d))),
      db
        .select(rateSelect)
        .from(pipelineRequests)
        .where(and(noReplays, gte(pipelineRequests.createdAt, minus30d))),

      // Latency percentiles for the last 24h
      db
        .select({
          p50: sql<number>`percentile_cont(0.5) within group (order by ${pipelineRequests.durationMs})`,
          p95: sql<number>`percentile_cont(0.95) within group (order by ${pipelineRequests.durationMs})`,
          p99: sql<number>`percentile_cont(0.99) within group (order by ${pipelineRequests.durationMs})`,
        })
        .from(pipelineRequests)
        .where(
          and(
            noReplays,
            gte(pipelineRequests.createdAt, minus24h),
            eq(pipelineRequests.status, 'success'),
            isNotNull(pipelineRequests.durationMs)
          )
        ),

      // Requests per day for the last 30d
      db
        .select({
          date: sql<string>`date_trunc('day', ${pipelineRequests.createdAt})::date::text`,
          count: count(),
        })
        .from(pipelineRequests)
        .where(and(noReplays, gte(pipelineRequests.createdAt, minus30d)))
        .groupBy(
          sql`date_trunc('day', ${pipelineRequests.createdAt})::date::text`
        )
        .orderBy(
          sql`date_trunc('day', ${pipelineRequests.createdAt})::date::text`
        ),

      // Top errors in the last 30d
      db
        .select({
          error: pipelineRequests.error,
          count: count(),
        })
        .from(pipelineRequests)
        .where(
          and(
            noReplays,
            gte(pipelineRequests.createdAt, minus30d),
            eq(pipelineRequests.status, 'error'),
            isNotNull(pipelineRequests.error)
          )
        )
        .groupBy(pipelineRequests.error)
        .orderBy(desc(count()))
        .limit(10),
    ]);

  function rateFromRow(rows: { total: number; successes: number }[]) {
    const row = rows[0];
    if (!row || Number(row.total) === 0) return null;
    return Number(row.successes) / Number(row.total);
  }

  const perc = percentiles[0] ?? null;

  return {
    successRate24h: rateFromRow(rate24hRows),
    successRate7d: rateFromRow(rate7dRows),
    successRate30d: rateFromRow(rate30dRows),
    p50_24h: perc?.p50 != null ? Number(perc.p50) : null,
    p95_24h: perc?.p95 != null ? Number(perc.p95) : null,
    p99_24h: perc?.p99 != null ? Number(perc.p99) : null,
    requestsPerDay30d: perDay.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    topErrors30d: errors
      .filter((e) => e.error != null)
      .map((e) => ({ error: e.error as string, count: Number(e.count) })),
  };
}
