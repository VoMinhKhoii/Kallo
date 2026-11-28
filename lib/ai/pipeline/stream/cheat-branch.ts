import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { initCheatBudgetAccounting } from '@/lib/ai/pipeline/telemetry/budget';
import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import { estimateCheatMeal } from '@/lib/domain/cheat/estimate';
import { resolveSliderNutrition } from '@/lib/domain/cheat/slider-nutrition';
import { stampAndStage } from './persist-analysis';
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
    emit,
    initCheatBudgetAccounting({
      db,
      requestId,
      model: resolveModelProfile().cheatModel,
    })
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
  const staged = await stampAndStage(ctx, {
    userId,
    pipelineResult: { entryMode: 'cheat', spec },
    rawInput: ctx.message,
    entryMode: 'cheat',
    attemptId: ctx.attemptId,
    pipelineRequestId: requestId,
  });
  if (!staged) {
    return;
  }

  emit({ type: 'cheat_estimate', spec });
  emit({
    type: 'analysis_complete',
    analysisId: staged.analysisId,
    loggedAt: staged.loggedAt.toISOString(),
  });

  logPipelineEnd(
    requestId,
    'success',
    Date.now() - startTime,
    db,
    undefined,
    null,
    { estimate: resolveSliderNutrition(spec, {}) }
  );
}
