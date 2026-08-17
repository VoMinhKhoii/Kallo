import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { StreamOptions } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db';
import type {
  AnalysisModelBudgetWorkKind,
  AnalysisModelProviderErrorCategory,
  RecordAnalysisModelBudgetEventInput,
} from '@/lib/infra/rate-limit/analysis-guard-types';
import { recordAnalysisModelBudgetEvent } from '@/lib/infra/rate-limit/analysis-model-budget';

export const ANALYSIS_MODEL_BUDGET_ROUTE = '/api/analyze-meal';
export const ANALYSIS_MODEL_PROVIDER = 'gemini';

/** Model-budget attribution for a pipeline run (primary vs shadow work). */
export interface PipelineBudget {
  workKind: AnalysisModelBudgetWorkKind;
  requestId?: string | null;
  providerErrorState?: { recorded: boolean };
}

export function recordAnalysisModelBudgetEventBestEffort(
  input: RecordAnalysisModelBudgetEventInput
): void {
  // ANALYSIS_BUDGET_EVENTS_ENABLED=false silences the always-on telemetry
  // table writes (3/request) when chasing pool contention or DB cost spikes.
  if (!readBooleanEnv('ANALYSIS_BUDGET_EVENTS_ENABLED', true)) return;
  void recordAnalysisModelBudgetEvent(input).catch((error) => {
    console.error('[ai/pipeline] failed to write model budget event', error);
  });
}

export function createBudgetAttemptRecorder(args: {
  db: AppDb;
  requestId: string | null;
  workKind: AnalysisModelBudgetWorkKind;
  model: string;
  providerErrorState?: { recorded: boolean };
}): NonNullable<StreamOptions['onAttemptComplete']> {
  return ({ error, inputTokens, model, outputTokens }) => {
    const errorCategory = error == null ? null : classifyProviderError(error);

    if (inputTokens == null && outputTokens == null && errorCategory == null) {
      return;
    }

    if (errorCategory) {
      if (args.providerErrorState) {
        args.providerErrorState.recorded = true;
      }
    }

    recordAnalysisModelBudgetEventBestEffort({
      db: args.db,
      requestId: args.requestId,
      route: ANALYSIS_MODEL_BUDGET_ROUTE,
      workKind: args.workKind,
      provider: ANALYSIS_MODEL_PROVIDER,
      model: model || args.model,
      requestCount: 0,
      inputTokens,
      outputTokens,
      errorCategory,
    });
  };
}

function getErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const statusMatch = error.message.match(/\b(408|429|500|502|503|504)\b/);
  return statusMatch ? Number.parseInt(statusMatch[1], 10) : null;
}

export function classifyProviderError(
  error: unknown
): AnalysisModelProviderErrorCategory | null {
  const message = error instanceof Error ? error.message : String(error);
  const status = getErrorStatus(error);

  if (/quota/i.test(message)) {
    return 'quota';
  }

  if (status === 429) {
    return 'rate_limit';
  }

  if (
    status === 408 ||
    status === 504 ||
    /timeout|timed out|AbortError/i.test(message)
  ) {
    return 'timeout';
  }

  if (status != null && status >= 500) {
    return 'server_error';
  }

  if (/UNAVAILABLE/i.test(message)) {
    return 'server_error';
  }

  if (
    /fetch failed|network error|socket hang up|ECONNRESET|EAI_AGAIN/i.test(
      message
    )
  ) {
    return 'network';
  }

  return null;
}

/**
 * One-call budget accounting setup for the v2 orchestrator: records the
 * primary request-count event immediately and returns per-stage attempt
 * recorders plus a catch-path error recorder. Parity with v1's inline wiring
 * in orchestrator.ts — without it the daily budget + provider-pressure guards
 * in lib/rate-limit/analysis-guards.ts are blind to v2 traffic.
 */
export function initV2BudgetAccounting(args: {
  db: AppDb;
  requestId: string | null;
  decompositionModel: string;
  nutritionModel: string;
}): {
  decompositionRecorder: NonNullable<StreamOptions['onAttemptComplete']>;
  nutritionRecorder: NonNullable<StreamOptions['onAttemptComplete']>;
  recordCatchError: (error: unknown) => void;
} {
  const providerErrorState = { recorded: false };
  recordAnalysisModelBudgetEventBestEffort({
    db: args.db,
    requestId: args.requestId,
    route: ANALYSIS_MODEL_BUDGET_ROUTE,
    workKind: 'primary',
    provider: ANALYSIS_MODEL_PROVIDER,
    model: args.nutritionModel,
    requestCount: 1,
  });
  return {
    decompositionRecorder: createBudgetAttemptRecorder({
      db: args.db,
      requestId: args.requestId,
      workKind: 'primary',
      model: args.decompositionModel,
      providerErrorState,
    }),
    nutritionRecorder: createBudgetAttemptRecorder({
      db: args.db,
      requestId: args.requestId,
      workKind: 'primary',
      model: args.nutritionModel,
      providerErrorState,
    }),
    recordCatchError: (error: unknown) => {
      const category = classifyProviderError(error);
      if (!category || providerErrorState.recorded) return;
      recordAnalysisModelBudgetEventBestEffort({
        db: args.db,
        requestId: args.requestId,
        route: ANALYSIS_MODEL_BUDGET_ROUTE,
        workKind: 'primary',
        provider: ANALYSIS_MODEL_PROVIDER,
        model: args.nutritionModel,
        requestCount: 0,
        errorCategory: category,
      });
    },
  };
}
