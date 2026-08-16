import type { NextRequest } from 'next/server';
import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import {
  buildAiRequestContext,
  buildUserContext,
} from '@/lib/ai/adapters/user-context';
import { logUnmatchedIngredients } from '@/lib/ai/matching/unmatched-log';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import {
  logPipelineEnd,
  logPipelineStart,
} from '@/lib/ai/pipeline/telemetry/logging';
import { createGeminiClient } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming';
import { encodeSSE } from '@/lib/ai/streaming';
import { withDeadline } from '@/lib/async/with-deadline';
import { estimateCheatMeal } from '@/lib/cheat/estimate';
import { db } from '@/lib/db';
import { buildRelogRawInput } from '@/lib/logging/relog/relog';
import { acquireAnalysisGuard } from './analysis-guard';
import { applyRelogRefs } from './apply-relog-refs';
import { getBillingAccessError } from './billing-access';
import { upsertPendingAnalysis } from './persist-analysis';
import {
  createGuardRelease,
  resolveGeminiConfig,
  validateRequest,
} from './request-validation';
import { toStreamErrorEvent } from './stream-errors';
import { emitPartialFailure } from './unresolved-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Bound the awaited `pendingAnalyses` insert so a stalled DB connection (the
// `max: 2` pool can starve under a saturated Supabase pooler) can't leave the
// SSE stream open forever between `stage: assembling` and `analysis_complete`.
// On timeout we emit an `error` terminal event and close, instead of hanging.
const PERSIST_DEADLINE_MS =
  Number(process.env.ANALYZE_PERSIST_DEADLINE_MS) || 15_000;
// The guard release in `finally` is DB-backed too; bound it so it can never
// block `controller.close()`.
const GUARD_RELEASE_DEADLINE_MS = 5_000;
export async function POST(request: NextRequest) {
  // Phase 1: Pre-stream validation — errors returned as JSON
  const validation = await validateRequest(request);
  if (validation.error) return validation.error;
  const {
    userId,
    message,
    locale,
    loggedAt,
    mode,
    cheatType,
    clarifyAnswer,
    cheatIntensity,
    attemptId,
    refs,
    profile,
  } = validation.data;

  // Fail before both provider spend and rate-limit consumption. The server's
  // entitlement state is authoritative; clients never self-grant access.
  const billingError = await getBillingAccessError({
    userId,
    profileCreatedAt: profile.createdAt,
    locale: locale ?? profile.preferredLocale ?? 'en',
  });
  if (billingError) return billingError;

  const providerConfig = resolveGeminiConfig();
  if (!providerConfig.ok) return providerConfig.error;
  const geminiConfig = providerConfig.config;

  const userContext = buildAiRequestContext(buildUserContext(profile), {
    mealText: message,
    requestLocale: locale,
    profileLocale: profile.preferredLocale,
  });
  const guard = await acquireAnalysisGuard(
    request,
    userId,
    locale ?? profile.preferredLocale ?? 'en'
  );
  if (!guard.allowed) return guard.error;
  const releaseGuard = createGuardRelease(guard.release);

  // Awaited so child trace inserts have a parent row to FK against
  let requestId: string;
  try {
    requestId = await logPipelineStart({
      userId,
      rawInput: message,
      userContext,
      db,
    });
  } catch (error) {
    await releaseGuard();
    throw error;
  }

  // Phase 2: Stream pipeline results as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };

      const startTime = Date.now();
      const promptVersionsUsed = new Map<string, string>();
      const traceContext = { requestId, db, userId, promptVersionsUsed };
      const releaseOnAbort = () => {
        void releaseGuard();
      };

      request.signal.addEventListener('abort', releaseOnAbort, { once: true });

      try {
        if (request.signal.aborted) {
          return;
        }

        const gemini = createGeminiClient(geminiConfig);

        // Cheat-meal branch: one reasoning call returns a slider spec instead
        // of the full decomposition pipeline. The precise path below is
        // untouched.
        if (mode === 'cheat') {
          const spec = await estimateCheatMeal(
            {
              description: message,
              cheatType,
              clarifyAnswer,
              cheatIntensity,
              userContext,
            },
            gemini,
            emit
          );

          if (request.signal.aborted) {
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

          // Stage the spec so confirm can recompute nutrition authoritatively
          // from the user's chosen levels. Persist BEFORE surfacing (same
          // ordering rationale as the precise path).
          const [insertedCheat] = await withDeadline(
            upsertPendingAnalysis({
              userId,
              pipelineResult: { entryMode: 'cheat', spec },
              rawInput: message,
              entryMode: 'cheat',
              loggedAt,
              attemptId,
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
          return;
        }

        const result = await analyzeMeal(
          message,
          userContext,
          db,
          gemini,
          emit,
          traceContext
        );

        // Check for abort after pipeline completes
        if (request.signal.aborted) {
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

        // Completeness gate — a Call-2 chunk failed after retries, or the
        // bridge withheld an ingredient that had no usable macro source.
        //
        // This is PER-INGREDIENT, and it has to be: the `empty_nutrition`
        // check below is `meal.items.some(...)`, which any one healthy item
        // satisfies. A meal whose "Mì gói" item was fully withheld therefore
        // passed it and persisted at 0g / 0 kcal beside a normal milk row,
        // under-counting the day by the entire dish. Runs BEFORE that gate so
        // the failure surfaces precisely. Nothing is staged for confirm.
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

        // Combined relog: fold the user's picks into the AI result AFTER the
        // pipeline ran on the free text alone. Deterministic copy — the picks
        // never entered `analyzeMeal`, so their goal-adjusted numbers are
        // reproduced, not re-estimated. Merging here (before preview + staging)
        // makes the `result` event, the pending row, and confirm all see one
        // combined meal with no extra client round-trip. `rawInput` folds in the
        // relog dish names so the saved meal's history text isn't just the free
        // text (which would drop the relogged dishes from the label).
        let rawInput = message;
        if (refs && refs.length > 0) {
          const applied = await applyRelogRefs(result.data, refs, userId);
          result.data = applied.result;
          rawInput = buildRelogRawInput([message, ...applied.dishNames]);
        }

        const meal = toParsedMeal(result.data);
        const hasNutrition = meal.items?.some(
          (item) => item.macros.calories !== 0 || item.macros.protein !== 0
        );

        if (!hasNutrition) {
          console.error('[analyze-meal] Pipeline returned all-null nutrition', {
            inputLength: message.length,
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

        // Persist the analysis BEFORE telling the client the meal is ready,
        // so a failed insert produces an error path with no half-state. If
        // we emit `result` first and then the insert throws, the client has
        // a populated meal preview with no `analysisId` to confirm it.
        const [inserted] = await withDeadline(
          upsertPendingAnalysis({
            userId,
            pipelineResult: result.data,
            rawInput,
            entryMode: 'precise',
            loggedAt,
            attemptId,
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
          logUnmatchedIngredients(
            result.data.unmatchedIngredients,
            null,
            db
          ).catch((err) =>
            console.error('Failed to log unmatched ingredients:', err)
          );
        }
      } catch (error) {
        console.error('[analyze-meal] Stream error:', error);
        const pvu =
          promptVersionsUsed.size > 0
            ? Object.fromEntries(promptVersionsUsed)
            : null;
        logPipelineEnd(
          requestId,
          'error',
          Date.now() - startTime,
          db,
          error instanceof Error ? error.message : 'unknown',
          pvu
        );

        emit(toStreamErrorEvent(error));
      } finally {
        request.signal.removeEventListener('abort', releaseOnAbort);
        // The guard release is a DB write; bound it so a stalled pool can't
        // block the stream close. Still awaited (best-effort) so the in-flight
        // counter is decremented before the instance can freeze.
        try {
          await withDeadline(
            Promise.resolve(releaseGuard()),
            GUARD_RELEASE_DEADLINE_MS
          );
        } catch (releaseError) {
          console.error(
            '[analyze-meal] Guard release timed out or failed:',
            releaseError
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
