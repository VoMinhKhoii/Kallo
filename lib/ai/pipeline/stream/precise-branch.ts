import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import { logUnmatchedIngredients } from '@/lib/ai/matching/unmatched-log';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import { holdToPlainRead } from '@/lib/ai/pipeline/plain-read/hold';
import { startPlainRead } from '@/lib/ai/pipeline/plain-read/plain-read';
import { PLAIN_READ_MODEL } from '@/lib/ai/pipeline/plain-read/prompt';
import { createBudgetAttemptRecorder } from '@/lib/ai/pipeline/telemetry/budget';
import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import { withDeadline } from '@/lib/core/async/with-deadline';
import { safeError } from '@/lib/core/errors/safe-error';
import {
  buildRelogRawInput,
  capRawInput,
} from '@/lib/domain/logging/relog/relog';
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

  // The plain read runs beside the pipeline; its total is the reference the
  // meal is held near once the pipeline finishes (see plain-read/hold.ts).
  const plainRead = startPlainRead({
    gemini,
    mealText: ctx.message,
    signal: ctx.signal,
    onAttemptComplete: createBudgetAttemptRecorder({
      db,
      requestId,
      workKind: 'primary',
      model: PLAIN_READ_MODEL,
      stage: 'plain_read',
    }),
  });
  // Every exit below, early or not, ends the read.
  try {
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
      promptVersionsUsed.size > 0
        ? Object.fromEntries(promptVersionsUsed)
        : null;

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
        pvu,
        { errorCode: result.error.type }
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

    // Hold the free-text meal near the plain read BEFORE the relog picks are
    // folded in: the read never saw the picks, and their numbers are frozen.
    const hold = holdToPlainRead(result.data, {
      read: await plainRead.settle(),
    });
    // The client may have hung up while the read settled: stage nothing.
    if (ctx.signal.aborted) return;
    result.data = hold.result;
    console.info(
      '[plain-read]',
      JSON.stringify({
        requestId,
        outcome: hold.outcome,
        appKcal: hold.appKcal,
        readKcal: hold.readKcal,
        factor: hold.factor,
        gramsFactor: hold.gramsFactor,
      })
    );

    // Combined relog: fold the user's picks into the AI result AFTER the pipeline
    // ran on the free text alone. Deterministic copy — the picks never entered
    // `analyzeMeal`, so their goal-adjusted numbers are reproduced, not
    // re-estimated. Merging here (before preview + staging) makes the `result`
    // event, the pending row, and confirm all see one combined meal with no extra
    // client round-trip.
    //
    // The LABEL is the user's own sentence when the client sent it: `message` is
    // the free text with the picks cut out, so rebuilding from its parts appends
    // them and reorders anything typed after one — `/cơm gà + 1 kem vani` saved as
    // `+ 1 kem vani, cơm gà`. The join stays as the fallback for clients that
    // send no `displayText`, where dropping the pick names would be worse.
    let rawInput = ctx.message;
    if (ctx.refs && ctx.refs.length > 0) {
      const applied = await ctx.mergePicks(result.data, ctx.refs, userId);
      result.data = applied.result;
      rawInput = ctx.displayText
        ? capRawInput(ctx.displayText)
        : buildRelogRawInput([ctx.message, ...applied.pickNames]);
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
        pvu,
        { errorCode: 'empty_nutrition', result: result.data }
      );
      emit({
        type: 'error',
        code: 'empty_nutrition',
        message: 'Try rewording this meal',
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
        pipelineRequestId: requestId,
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
      pvu,
      { result: result.data }
    );
    if (result.data.unmatchedIngredients.length > 0) {
      logUnmatchedIngredients(result.data.unmatchedIngredients, null, db).catch(
        (err) =>
          console.error('Failed to log unmatched ingredients:', safeError(err))
      );
    }
  } finally {
    plainRead.abort();
  }
}
