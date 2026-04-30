import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';

import type { AppDb } from '@/lib/db';
import {
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
  promptVersions,
} from '@/lib/db/schema';

// ─── Filters schema ───────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid();

export const requestFiltersSchema = z.object({
  status: z
    .union([
      z.enum(['pending', 'success', 'error']),
      z.literal('all').transform(() => undefined),
    ])
    .optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  // URLSearchParams sends strings; default to 'false' then transform to boolean.
  includeReplays: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type RequestFilters = z.output<typeof requestFiltersSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Single replay exclusion condition — exported so tests can assert by reference.
 */
export const REPLAY_EXCLUSION = isNull(pipelineRequests.replayOfRequestId);

/**
 * Builds the WHERE conditions for pipeline_requests queries.
 * Exported so tests can inspect the SQL shape without a real DB.
 */
export function buildRequestsWhere(
  filter: Pick<RequestFilters, 'status' | 'userId' | 'dateFrom' | 'dateTo'>,
  includeReplays: boolean
) {
  const conditions = [];

  if (!includeReplays) {
    conditions.push(REPLAY_EXCLUSION);
  }
  if (filter.status) {
    conditions.push(eq(pipelineRequests.status, filter.status));
  }
  if (filter.userId) {
    conditions.push(eq(pipelineRequests.userId, filter.userId));
  }
  if (filter.dateFrom) {
    conditions.push(gte(pipelineRequests.createdAt, filter.dateFrom));
  }
  if (filter.dateTo) {
    const nextDay = new Date(filter.dateTo);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    conditions.push(lt(pipelineRequests.createdAt, nextDay));
  }

  return conditions;
}

// ─── Query functions ──────────────────────────────────────────────────────────

export async function listRequests(
  db: AppDb,
  opts: {
    filter?: Partial<Omit<RequestFilters, 'page' | 'pageSize'>>;
    page?: number;
    pageSize?: number;
    includeReplays?: boolean;
  } = {}
) {
  const { filter = {}, page = 1, pageSize = 50, includeReplays = false } = opts;

  const where = buildRequestsWhere(
    {
      status: filter.status,
      userId: filter.userId,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
    },
    includeReplays
  );

  const whereClause = where.length > 0 ? and(...where) : undefined;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(pipelineRequests)
      .where(whereClause)
      .orderBy(desc(pipelineRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(pipelineRequests).where(whereClause),
  ]);

  return { rows, total: Number(total) };
}

export async function getRequestDetail(db: AppDb, id: string) {
  if (!uuidSchema.safeParse(id).success) return null;

  const [request] = await db
    .select()
    .from(pipelineRequests)
    .where(eq(pipelineRequests.id, id))
    .limit(1);

  if (!request) return null;

  const [stageLogs, llmCalls] = await Promise.all([
    db
      .select()
      .from(pipelineStageLogs)
      .where(eq(pipelineStageLogs.requestId, id))
      .orderBy(pipelineStageLogs.stageIndex),
    db
      .select()
      .from(pipelineLlmCalls)
      .where(eq(pipelineLlmCalls.requestId, id))
      .orderBy(pipelineLlmCalls.createdAt),
  ]);

  return { request, stageLogs, llmCalls };
}

export async function listPrompts(db: AppDb) {
  const rows = await db
    .select({
      name: promptVersions.name,
      versionCount: count(promptVersions.id),
      latestSeenAt: sql<Date>`max(${promptVersions.firstSeenAt})`,
    })
    .from(promptVersions)
    .groupBy(promptVersions.name)
    .orderBy(desc(sql`max(${promptVersions.firstSeenAt})`));

  return rows;
}

export async function getPromptVersions(db: AppDb, name: string) {
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.name, name))
    .orderBy(desc(promptVersions.firstSeenAt));
}

export async function getRequestsForVersion(
  db: AppDb,
  versionId: string,
  page = 1,
  pageSize = 50
) {
  if (!uuidSchema.safeParse(versionId).success) return { rows: [], total: 0 };

  // pipeline_requests.prompt_versions_used is jsonb; we use a text search
  // via the LLM calls join instead, which has a proper FK.
  const subquery = db
    .selectDistinct({ requestId: pipelineLlmCalls.requestId })
    .from(pipelineLlmCalls)
    .where(eq(pipelineLlmCalls.promptVersionId, versionId))
    .as('sub');

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: pipelineRequests.id,
        userId: pipelineRequests.userId,
        status: pipelineRequests.status,
        durationMs: pipelineRequests.durationMs,
        createdAt: pipelineRequests.createdAt,
        rawInput: pipelineRequests.rawInput,
        error: pipelineRequests.error,
      })
      .from(pipelineRequests)
      .innerJoin(subquery, eq(pipelineRequests.id, subquery.requestId))
      .orderBy(desc(pipelineRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(pipelineRequests)
      .innerJoin(subquery, eq(pipelineRequests.id, subquery.requestId)),
  ]);

  return { rows, total: Number(total) };
}

// ─── Health aggregates ────────────────────────────────────────────────────────

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
