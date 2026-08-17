import { and, count, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { uuidSchema } from '@/lib/core/validation/primitives';
import type { AppDb } from '@/lib/infra/db';
import {
  pipelineLlmCallMetadata,
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
} from '@/lib/infra/db/schema';

// ─── Filters schema ───────────────────────────────────────────────────────────

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

export type RequestListRow = Pick<
  typeof pipelineRequests.$inferSelect,
  | 'id'
  | 'status'
  | 'durationMs'
  | 'rawInput'
  | 'createdAt'
  | 'replayOfRequestId'
>;

export type RequestDetailLlmCallMetadata = Pick<
  typeof pipelineLlmCallMetadata.$inferSelect,
  | 'provider'
  | 'region'
  | 'cacheStatus'
  | 'inputTokens'
  | 'outputTokens'
  | 'cachedTokens'
  | 'thoughtTokens'
  | 'promptChars'
  | 'schemaChars'
>;

export type RequestDetailLlmCall = typeof pipelineLlmCalls.$inferSelect & {
  metadata: RequestDetailLlmCallMetadata | null;
};

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
      .select({
        id: pipelineRequests.id,
        status: pipelineRequests.status,
        durationMs: pipelineRequests.durationMs,
        rawInput: pipelineRequests.rawInput,
        createdAt: pipelineRequests.createdAt,
        replayOfRequestId: pipelineRequests.replayOfRequestId,
      })
      .from(pipelineRequests)
      .where(whereClause)
      .orderBy(desc(pipelineRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(pipelineRequests).where(whereClause),
  ]);

  return { rows: rows satisfies RequestListRow[], total: Number(total) };
}

export async function getRequestDetail(db: AppDb, id: string) {
  if (!uuidSchema.safeParse(id).success) return null;

  const [request] = await db
    .select()
    .from(pipelineRequests)
    .where(eq(pipelineRequests.id, id))
    .limit(1);

  if (!request) return null;

  const [stageLogs, llmCallRows] = await Promise.all([
    db
      .select()
      .from(pipelineStageLogs)
      .where(eq(pipelineStageLogs.requestId, id))
      .orderBy(pipelineStageLogs.stageIndex),
    db
      .select({
        call: pipelineLlmCalls,
        metadata: {
          llmCallId: pipelineLlmCallMetadata.llmCallId,
          provider: pipelineLlmCallMetadata.provider,
          region: pipelineLlmCallMetadata.region,
          cacheStatus: pipelineLlmCallMetadata.cacheStatus,
          inputTokens: pipelineLlmCallMetadata.inputTokens,
          outputTokens: pipelineLlmCallMetadata.outputTokens,
          cachedTokens: pipelineLlmCallMetadata.cachedTokens,
          thoughtTokens: pipelineLlmCallMetadata.thoughtTokens,
          promptChars: pipelineLlmCallMetadata.promptChars,
          schemaChars: pipelineLlmCallMetadata.schemaChars,
        },
      })
      .from(pipelineLlmCalls)
      .leftJoin(
        pipelineLlmCallMetadata,
        eq(pipelineLlmCallMetadata.llmCallId, pipelineLlmCalls.id)
      )
      .where(eq(pipelineLlmCalls.requestId, id))
      .orderBy(pipelineLlmCalls.createdAt),
  ]);

  const llmCalls: RequestDetailLlmCall[] = llmCallRows.map(
    ({ call, metadata }) => ({
      ...call,
      metadata: metadata?.llmCallId
        ? {
            provider: metadata.provider,
            region: metadata.region,
            cacheStatus: metadata.cacheStatus,
            inputTokens: metadata.inputTokens,
            outputTokens: metadata.outputTokens,
            cachedTokens: metadata.cachedTokens,
            thoughtTokens: metadata.thoughtTokens,
            promptChars: metadata.promptChars,
            schemaChars: metadata.schemaChars,
          }
        : null,
    })
  );

  return { request, stageLogs, llmCalls };
}
