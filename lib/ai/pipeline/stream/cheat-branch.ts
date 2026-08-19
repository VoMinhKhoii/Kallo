import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import { withDeadline } from '@/lib/core/async/with-deadline';
import { estimateCheatMeal } from '@/lib/domain/cheat/estimate';
import { PERSIST_DEADLINE_MS, upsertPendingAnalysis } from './persist-analysis';
import type { StreamRun } from './types';

/**
 * Cheat-meal outcome: one reasoning call returns a slider spec instead of the
 * full decomposition pipeline. Relog picks can never reach here — the request
 * schema rejects `mode: 'cheat'` combined with `refs`.
 */
export async function runCheatBranch({
  emit,
  ctx,
  gemini,
  startTime,
}: StreamRun): Promise<void> {
  const { db, requestId, userId } = ctx;

  const spec = await estimateCheatMeal(
    {
      description: ctx.message,
      cheatType: ctx.cheatType,
      clarifyAnswer: ctx.clarifyAnswer,
      cheatIntensity: ctx.cheatIntensity,
      userContext: ctx.userContext,
    },
    gemini,
    emit
  );

  if (ctx.signal.aborted) {
    return;
  }

  // Vague input — surface the clarifying question and stop. The client
  // re-calls with `clarifyAnswer`; nothing is staged for confirm yet.
  if (spec.clarifyingQuestion) {
    emit({ type: 'cheat_estimate', spec });
    logPipelineEnd(
      requestId,
      'success',
      Date.now() - startTime,
      db,
      undefined,
      null
    );
    return;
  }

  // Stage the spec so confirm can recompute nutrition authoritatively from the
  // user's chosen levels. Persist BEFORE surfacing (same ordering rationale as
  // the precise path).
  const [insertedCheat] = await withDeadline(
    upsertPendingAnalysis({
      userId,
      pipelineResult: { entryMode: 'cheat', spec },
      rawInput: ctx.message,
      entryMode: 'cheat',
      loggedAt: ctx.loggedAt,
      attemptId: ctx.attemptId,
    }),
    PERSIST_DEADLINE_MS
  );

  emit({ type: 'cheat_estimate', spec });
  emit({ type: 'analysis_complete', analysisId: insertedCheat.id });

  logPipelineEnd(
    requestId,
    'success',
    Date.now() - startTime,
    db,
    undefined,
    null
  );
}
