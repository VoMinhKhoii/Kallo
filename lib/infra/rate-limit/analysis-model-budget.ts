import { sql } from 'drizzle-orm';
import { db as appDb } from '@/lib/infra/db/client';
import { analysisModelBudgetEvents } from '@/lib/infra/db/schema';
import { readNonNegativeInteger } from './analysis-guard-limits';
import type {
  AnalysisModelBudgetSource,
  RecordAnalysisModelBudgetEventInput,
} from './analysis-guard-types';

function toInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const drizzleAnalysisModelBudgetSource: AnalysisModelBudgetSource = {
  async getDailyUsage(input) {
    const budgetDb = input.db ?? appDb;
    const [row] = await budgetDb
      .select({
        globalRequests: sql<number>`coalesce(sum(${analysisModelBudgetEvents.requestCount}), 0)::int`,
        shadowRequests: sql<number>`coalesce(sum(${analysisModelBudgetEvents.requestCount}) filter (where ${analysisModelBudgetEvents.workKind} = 'shadow'), 0)::int`,
        globalTokens: sql<number>`coalesce(sum(${analysisModelBudgetEvents.inputTokens} + ${analysisModelBudgetEvents.outputTokens}), 0)::int`,
      })
      .from(analysisModelBudgetEvents)
      .where(
        sql`${analysisModelBudgetEvents.createdAt} >= ${input.dayStart} AND ${analysisModelBudgetEvents.createdAt} <= ${input.now}`
      );

    return {
      globalRequests: toInteger(row?.globalRequests),
      shadowRequests: toInteger(row?.shadowRequests),
      globalTokens: toInteger(row?.globalTokens),
    };
  },
  async getProviderErrorCount(input) {
    const budgetDb = input.db ?? appDb;
    const [row] = await budgetDb
      .select({
        providerErrors: sql<number>`count(*)::int`,
      })
      .from(analysisModelBudgetEvents)
      .where(
        sql`${analysisModelBudgetEvents.createdAt} >= ${input.windowStart} AND ${analysisModelBudgetEvents.createdAt} <= ${input.now} AND ${analysisModelBudgetEvents.provider} = ${input.provider} AND ${analysisModelBudgetEvents.errorCategory} IS NOT NULL`
      );

    return toInteger(row?.providerErrors);
  },
};

export async function recordAnalysisModelBudgetEvent(
  input: RecordAnalysisModelBudgetEventInput
): Promise<void> {
  const eventDb = input.db ?? appDb;
  const now = input.now?.() ?? new Date();

  const insertResult = eventDb.insert(analysisModelBudgetEvents).values({
    createdAt: now,
    requestId: input.requestId ?? null,
    route: input.route,
    workKind: input.workKind,
    provider: input.provider,
    model: input.model ?? null,
    requestCount: readNonNegativeInteger(input.requestCount, 1),
    inputTokens: readNonNegativeInteger(input.inputTokens, 0),
    outputTokens: readNonNegativeInteger(input.outputTokens, 0),
    errorCategory: input.errorCategory ?? null,
  });

  if (
    insertResult &&
    typeof insertResult === 'object' &&
    'returning' in insertResult &&
    typeof insertResult.returning === 'function'
  ) {
    await insertResult.returning({ id: analysisModelBudgetEvents.id });
    return;
  }

  await insertResult;
}
