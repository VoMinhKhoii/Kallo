import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import {
  ANALYSIS_MODEL_BUDGET_ROUTE,
  ANALYSIS_MODEL_PROVIDER,
} from '@/lib/ai/pipeline/telemetry/budget';
import type { PipelineResponse } from '@/lib/ai/types/result';
import type { AppDb } from '@/lib/infra/db';
import { checkNonessentialAnalysisGuards } from '@/lib/infra/rate-limit/analysis-guards';
import {
  createShadowGuard,
  getPrimaryP95Ms,
  isEmbeddingRateLimited,
} from './guards';
import {
  runShadowAsync,
  type ShadowGuard,
  type ShadowRunnerDeps,
  type ShadowRunPersistRow,
} from './runner';
import { isShadowSampled } from './sampling';

const NUTRITION_PROMPT_LABEL_CANDIDATE =
  process.env.SHADOW_CANDIDATE_PROMPT_LABEL ?? 'production';
const NUTRITION_MODEL_CANDIDATE =
  process.env.SHADOW_CANDIDATE_MODEL ?? resolveModelProfile().nutritionModel;
const SHADOW_PRIMARY_P95_THRESHOLD_MS = 4000;
const SHADOW_DB_POOL_WAIT_THRESHOLD_MS = 1000;

export interface ShadowConfig {
  enabled: boolean;
  /** Optional override of the locked 5% sampling rate for tests. */
  rate?: number;
  persistShadowRun?: ShadowRunnerDeps['persistShadowRun'];
  guard?: ShadowGuard;
  candidatePromptLabel?: string;
  candidateModel?: string;
}

export function scheduleShadowRun(args: {
  db: AppDb;
  traceContext?: AnalyzeMealTraceContext;
  response: PipelineResponse;
  primaryMs: number;
  shadow?: ShadowConfig;
  /** Runs the candidate pipeline for the shadow comparison. */
  runCandidate: (candidateModel: string) => Promise<PipelineResponse>;
}): void {
  if (!args.traceContext) {
    return;
  }

  const shadowCfg = args.shadow ?? defaultShadowConfigFromEnv(args.db);
  const candidateModel = shadowCfg.candidateModel ?? NUTRITION_MODEL_CANDIDATE;
  const guard =
    shadowCfg.guard ??
    defaultShadowGuard({
      db: args.db,
      requestId: args.traceContext.requestId,
      candidateModel,
    });
  guard.onPrimaryComplete(args.primaryMs);

  if (
    !shadowCfg.enabled ||
    !isShadowSampled(args.traceContext.requestId, {
      enabled: true,
      rate: shadowCfg.rate,
    })
  ) {
    return;
  }

  // Defer to a microtask so the response can stream to the client first.
  // We also wait for the parent pipeline_runs row to persist before kicking
  // off the shadow path: pipeline_shadow_runs.primary_run_id is an FK to
  // pipeline_runs.id, and the parent insert is fire-and-forget. Without this
  // await the shadow row could race the parent and either drop its FK link
  // (set null) or fail the insert outright.
  queueMicrotask(async () => {
    if (args.response.__telemetryRunPersisted) {
      try {
        await args.response.__telemetryRunPersisted;
      } catch {
        // The parent write already logged its own error. Continue: the
        // shadow row will simply land with primary_run_id=null and the
        // outcome captured below, which still gives us divergence data.
      }
    }
    void runShadowAsync(
      {
        requestId: args.traceContext?.requestId ?? '',
        primary: args.response,
        primaryRunId: args.response.__telemetryRunId,
        candidatePromptLabel:
          shadowCfg.candidatePromptLabel ?? NUTRITION_PROMPT_LABEL_CANDIDATE,
        candidateModel,
      },
      {
        runCandidate: () => args.runCandidate(candidateModel),
        persistShadowRun:
          shadowCfg.persistShadowRun ?? persistShadowRunDefault(args.db),
        now: () => Date.now(),
      },
      guard
    );
  });
}

function defaultShadowConfigFromEnv(db: AppDb): ShadowConfig {
  return {
    enabled: readBooleanEnv('SHADOW_RUNNER_ENABLED', false),
    persistShadowRun: persistShadowRunDefault(db),
  };
}

function defaultShadowGuard(args: {
  db: AppDb;
  requestId: string;
  candidateModel: string;
}): ShadowGuard {
  return createShadowGuard({
    primaryP95Ms: getPrimaryP95Ms,
    primaryP95ThresholdMs: SHADOW_PRIMARY_P95_THRESHOLD_MS,
    dbPoolWaitMs: () => 0,
    dbPoolWaitThresholdMs: SHADOW_DB_POOL_WAIT_THRESHOLD_MS,
    embeddingRateLimited: isEmbeddingRateLimited,
    nonessentialGuard: () =>
      checkNonessentialAnalysisGuards({
        db: args.db,
        requestId: args.requestId,
        route: ANALYSIS_MODEL_BUDGET_ROUTE,
        workKind: 'shadow',
        provider: ANALYSIS_MODEL_PROVIDER,
        model: args.candidateModel,
        reserve: true,
      }),
  });
}

function persistShadowRunDefault(
  db: AppDb
): ShadowRunnerDeps['persistShadowRun'] {
  return async (row: ShadowRunPersistRow) => {
    const { pipelineShadowRuns } = await import('@/lib/infra/db/schema');
    await db.insert(pipelineShadowRuns).values({
      requestId: row.requestId,
      primaryRunId: row.primaryRunId,
      candidatePromptLabel: row.candidatePromptLabel,
      candidateModel: row.candidateModel,
      primaryOutput: row.primaryOutput,
      candidateOutput: row.candidateOutput,
      divergence: row.divergence,
      outcome: row.outcome,
      candidateMs: row.candidateMs,
    });
  };
}
