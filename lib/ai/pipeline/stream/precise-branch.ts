import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import { logUnmatchedIngredients } from '@/lib/ai/matching/unmatched-log';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import { withDeadline } from '@/lib/core/async/with-deadline';
import { buildRelogRawInput } from '@/lib/domain/logging/relog/relog';
import { PERSIST_DEADLINE_MS, upsertPendingAnalysis } from './persist-analysis';
import type { StreamRun } from './types';
import { emitPartialFailure } from './unresolved-response';

/**
 * Precise outcome: the full decomposition pipeline, its two completeness gates,
 * the relog merge, and staging. The gate ORDER below is load-bearing — see the
 * comments at each one.
 */
export async function runPreciseBranch({
  emit,
  ctx,
  gemini,
  startTime,
  promptVersionsUsed,
}: StreamRun): Promise<void> {
  const { db, requestId, userId } = ctx;

  const result = await analyzeMeal(
    ctx.message,
    ctx.userContext,
    db,
    gemini,
    emit,
    {
      requestId,
      db,
      userId,
      promptVersionsUsed,
    }
  );

  // Check for abort after pipeline completes
  if (ctx.signal.aborted) {
    return;
  }

  const pvu =
    promptVersionsUsed.size > 0 ? Object.fromEntries(promptVersionsUsed) : null;

  if (!result.success) {
    console.error(
      '[analyze-meal] Pipeline returned error:',
      result.error.type,
      result.error.message
    );
    logPipelineEnd(
      requestId,
      'error',
      Date.now() - startTime,
      db,
      result.error.message,
      pvu
    );
    emit({
      type: 'error',
      code: result.error.type,
      message: result.error.message,
      retryable: result.error.retryable,
    });
    return;
  }

  // Completeness gate — a Call-2 chunk failed after retries, or the bridge
  // withheld an ingredient that had no usable macro source.
  //
  // This is PER-INGREDIENT, and it has to be: the `empty_nutrition` check below
  // is `meal.items.some(...)`, which any one healthy item satisfies. A meal
  // whose "Mì gói" item was fully withheld therefore passed it and persisted at
  // 0g / 0 kcal beside a normal milk row, under-counting the day by the entire
  // dish. Runs BEFORE that gate so the failure surfaces precisely. Nothing is
  // staged for confirm.
  if (result.unresolved) {
    await emitPartialFailure({
      emit,
      requestId,
      db,
      startTime,
      promptVersionsUsed: pvu,
      unresolved: result.unresolved,
    });
    return;
  }

  // Combined relog: fold the user's picks into the AI result AFTER the pipeline
  // ran on the free text alone. Deterministic copy — the picks never entered
  // `analyzeMeal`, so their goal-adjusted numbers are reproduced, not
  // re-estimated. Merging here (before preview + staging) makes the `result`
  // event, the pending row, and confirm all see one combined meal with no extra
  // client round-trip. `rawInput` folds in the relog dish names so the saved
  // meal's history text isn't just the free text (which would drop the
  // relogged dishes from the label).
  let rawInput = ctx.message;
  if (ctx.refs && ctx.refs.length > 0) {
    const applied = await ctx.mergeRelogRefs(result.data, ctx.refs, userId);
    result.data = applied.result;
    rawInput = buildRelogRawInput([ctx.message, ...applied.dishNames]);
  }

  const meal = toParsedMeal(result.data);
  const hasNutrition = meal.items?.some(
    (item) => item.macros.calories !== 0 || item.macros.protein !== 0
  );

  if (!hasNutrition) {
    console.error('[analyze-meal] Pipeline returned all-null nutrition', {
      inputLength: ctx.message.length,
    });
    logPipelineEnd(
      requestId,
      'error',
      Date.now() - startTime,
      db,
      'empty_nutrition',
      pvu
    );
    emit({
      type: 'error',
      code: 'empty_nutrition',
      message:
        'Could not estimate nutrition for this meal. Please try describing it differently.',
      retryable: true,
    });
    return;
  }

  // Persist the analysis BEFORE telling the client the meal is ready, so a
  // failed insert produces an error path with no half-state. If we emit
  // `result` first and then the insert throws, the client has a populated meal
  // preview with no `analysisId` to confirm it.
  const [inserted] = await withDeadline(
    upsertPendingAnalysis({
      userId,
      pipelineResult: result.data,
      rawInput,
      entryMode: 'precise',
      loggedAt: ctx.loggedAt,
      attemptId: ctx.attemptId,
    }),
    PERSIST_DEADLINE_MS
  );

  // Now safe to surface the meal — durable row exists.
  emit({ type: 'result', data: meal });

  // Terminal event — analysis stored, safe to confirm.
  emit({
    type: 'analysis_complete',
    analysisId: inserted.id,
  });

  // Fire-and-forget: log success + unmatched ingredients
  logPipelineEnd(
    requestId,
    'success',
    Date.now() - startTime,
    db,
    undefined,
    pvu
  );
  if (result.data.unmatchedIngredients.length > 0) {
    logUnmatchedIngredients(result.data.unmatchedIngredients, null, db).catch(
      (err) => console.error('Failed to log unmatched ingredients:', err)
    );
  }
}
