import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { analysisModelBudgetEvents } from '@/lib/infra/db/schema';

export type AnalysisModelBudgetWorkKind = 'primary' | 'shadow' | 'nonessential';

export type AnalysisModelProviderErrorCategory =
  | 'rate_limit'
  | 'quota'
  | 'server_error'
  | 'timeout'
  | 'network'
  | 'unknown';

export interface RecordAnalysisModelBudgetEventInput {
  db?: AppDb;
  now?: () => Date;
  requestId?: string | null;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  model?: string | null;
  requestCount?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  /** Subset of `inputTokens` served from the provider cache. */
  cachedTokens?: number | null;
  /** Thinking tokens — billed as output, not included in `outputTokens`. */
  thoughtTokens?: number | null;
  /** Subset of `inputTokens` written to Claude's cache (billed 1.25x input). */
  cacheWriteTokens?: number | null;
  /** USD the attempt cost; null when unknown (no usage, unpriced model). */
  costUsd?: number | null;
  /** Wall time of the attempt; null on rows that are not an attempt. */
  latencyMs?: number | null;
  /** The Claude model a Gemini attempt stood in for after it failed. */
  fallbackFrom?: string | null;
  errorCategory?: AnalysisModelProviderErrorCategory | null;
}

function readNonNegativeInteger(
  value: number | null | undefined,
  fallback: number
) {
  if (value == null) return fallback;
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

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
    cachedTokens: readNonNegativeInteger(input.cachedTokens, 0),
    cacheWriteTokens: readNonNegativeInteger(input.cacheWriteTokens, 0),
    thoughtTokens: readNonNegativeInteger(input.thoughtTokens, 0),
    costUsd: input.costUsd != null && input.costUsd >= 0 ? input.costUsd : null,
    latencyMs:
      input.latencyMs == null
        ? null
        : readNonNegativeInteger(input.latencyMs, 0),
    fallbackFrom: input.fallbackFrom ?? null,
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
