import { eq } from 'drizzle-orm';
import {
  cloudTrace,
  traceResultSummary,
} from '@/lib/ai/pipeline/telemetry/cloud-trace/cloud-trace';
import type {
  GoalAdjustedNutrient,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type { PipelineResult } from '@/lib/ai/types/result';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';
import { pipelineRequests } from '@/lib/infra/db/schema';

export interface LogPipelineStartArgs {
  userId: string;
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  /** When set, caller controls the requestId (used by replay). */
  requestId?: string;
  /** Marks the row as a dry-run replay of the given original request. */
  replayOfRequestId?: string;
  /** When true, persists the row with dry_run=true (no real Gemini call). */
  dryRun?: boolean;
  entryMode?: string;
}

/**
 * Awaitable INSERT into pipeline_requests before the pipeline starts.
 * Awaits the DB write so child trace inserts (stage_logs, llm_calls)
 * have a parent row to FK against.
 * Returns the requestId for correlation with logPipelineEnd.
 * Throws if the parent row cannot be created.
 */
export async function logPipelineStart(
  args: LogPipelineStartArgs
): Promise<string> {
  const id = args.requestId ?? crypto.randomUUID();
  cloudTrace.start(id, {
    rawInput: args.rawInput,
    entryMode: args.entryMode ?? 'precise',
    pipelineVersion: process.env.PIPELINE_V2_ENABLED === 'false' ? 'v1' : 'v2',
    gitSha: process.env.GIT_COMMIT_SHA ?? null,
    profile: process.env.PIPELINE_MODEL_PROFILE ?? 'stable',
    createdAt: new Date().toISOString(),
  });

  try {
    await args.db.insert(pipelineRequests).values({
      id,
      userId: args.userId,
      rawInput: args.rawInput,
      userContextJson: args.userContext as unknown as Record<string, unknown>,
      ...(args.replayOfRequestId
        ? { replayOfRequestId: args.replayOfRequestId }
        : {}),
      ...(args.dryRun ? { dryRun: true } : {}),
    });
  } catch (err) {
    console.error('[pipeline-logging] Failed to create request log:', err);
    throw err;
  }

  return id;
}

/**
 * Awaitable UPDATE to record pipeline final state.
 * Use on the replay path where the redirect MUST land on a terminal-state row.
 * The production path keeps using the fire-and-forget logPipelineEnd.
 */
export async function setPipelineFinalState(args: {
  db: AppDb;
  requestId: string;
  status: 'success' | 'error';
  durationMs: number;
  errorMessage?: string;
  promptVersionsUsed?: Record<string, string> | null;
  result?: PipelineResult;
  errorCode?: string;
}): Promise<void> {
  await args.db
    .update(pipelineRequests)
    .set({
      status: args.status,
      durationMs: args.durationMs,
      error: args.errorMessage ?? null,
      promptVersionsUsed: args.promptVersionsUsed ?? null,
      ...finalSummary(
        args.requestId,
        args.status,
        args.durationMs,
        args.errorCode,
        args.result
      ),
    })
    .where(eq(pipelineRequests.id, args.requestId));
}

/**
 * Fire-and-forget UPDATE to record pipeline outcome.
 * No-op if requestId is null (DB write failed during start).
 * Never blocks the response — all errors are caught and logged only.
 *
 * @param promptVersionsUsed - When non-null, persisted on the row so replays
 *   can reproduce the exact prompt versions used in this request.
 */
export function logPipelineEnd(
  requestId: string | null,
  status: 'success' | 'error',
  durationMs: number,
  db: AppDb,
  error?: string,
  promptVersionsUsed?: Record<string, string> | null,
  outcome: {
    result?: PipelineResult;
    errorCode?: string;
    estimate?: Pick<NutritionValues, GoalAdjustedNutrient>;
  } = {}
): void {
  if (!requestId) return;

  const extra = promptVersionsUsed ? { promptVersionsUsed } : {};

  const summary = finalSummary(
    requestId,
    status,
    durationMs,
    outcome.errorCode,
    outcome.result,
    outcome.estimate
  );
  try {
    void db
      .update(pipelineRequests)
      .set({ status, durationMs, error: error ?? null, ...extra, ...summary })
      .where(eq(pipelineRequests.id, requestId))
      .catch((err) => {
        console.error('[pipeline-logging] Failed to update request log:', err);
      });
  } catch (err) {
    console.error('[pipeline-logging] Failed to update request log:', err);
  }
}

function finalSummary(
  requestId: string,
  status: string,
  durationMs: number,
  errorCode?: string,
  result?: PipelineResult,
  estimate?: Pick<NutritionValues, GoalAdjustedNutrient>
) {
  const capture = cloudTrace.finish(requestId, {
    status,
    durationMs,
    errorCode: errorCode ?? null,
    summary:
      traceResultSummary(result) ??
      (estimate
        ? {
            kcal: estimate.caloriesKcal,
            protein: estimate.proteinG,
            carbs: estimate.carbohydrateG,
            fat: estimate.fatG,
            items: [],
          }
        : null),
  });
  const nutrition = result?.displayedNutrition ?? estimate;
  return {
    ...capture,
    mealName:
      (
        result?.mealItems.map((item) => item.name).join(' · ') ||
        capture.mealName
      )?.slice(0, 160) ?? null,
    caloriesKcal: nutrition?.caloriesKcal ?? null,
    proteinG: nutrition?.proteinG ?? null,
    carbohydrateG: nutrition?.carbohydrateG ?? null,
    fatG: nutrition?.fatG ?? null,
    itemCount: result?.mealItems.length ?? null,
    errorCode: errorCode ?? null,
  };
}
