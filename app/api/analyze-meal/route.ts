import type { NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { createGeminiClient } from '@/lib/ai/gemini';
import {
  buildAiRequestContext,
  buildUserContext,
  toParsedMeal,
} from '@/lib/ai/mappers';
import { logUnmatchedIngredients } from '@/lib/ai/matching';
import { analyzeMeal } from '@/lib/ai/pipeline';
import { estimateCheatMeal } from '@/lib/ai/pipeline/cheat-estimate';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import {
  logPipelineEnd,
  logPipelineStart,
} from '@/lib/ai/pipeline/telemetry/logging';
import type { StreamEvent } from '@/lib/ai/streaming';
import { encodeSSE } from '@/lib/ai/streaming';
import { db } from '@/lib/db';
import { analysisGuardEvents, pendingAnalyses } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import {
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
} from '@/lib/rate-limit/analysis-guards';

import {
  createGuardRelease,
  getRequestIp,
  validateRequest,
} from './request-validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const analyzeMealRoute = '/api/analyze-meal';
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
    profile,
    geminiConfig,
  } = validation.data;

  const userContext = buildAiRequestContext(buildUserContext(profile), {
    mealText: message,
    requestLocale: locale,
    profileLocale: profile.preferredLocale,
  });
  const ip = getRequestIp(request);

  const guard = await checkAnalysisGuards({
    userId,
    ip,
    route: analyzeMealRoute,
    db,
  });

  if (!guard.allowed) {
    if (readBooleanEnv('ANALYSIS_GUARD_EVENT_LOGGING_ENABLED', true)) {
      try {
        await db.insert(analysisGuardEvents).values(
          buildAnalysisGuardEvent({
            userId,
            ip,
            route: analyzeMealRoute,
            reason: guard.reason,
            retryAfterSeconds: guard.retryAfterSeconds,
          })
        );
      } catch (error) {
        console.error(
          '[analyze-meal] Failed to log analysis guard event:',
          error
        );
      }
    }

    const t = await getTranslations({
      locale: locale ?? profile.preferredLocale ?? 'en',
      namespace: 'errors',
    });
    return Response.json(Errors.rateLimited(t('rateLimited')).toJSON(), {
      status: guard.status,
      headers: { 'Retry-After': String(guard.retryAfterSeconds) },
    });
  }

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
          const [insertedCheat] = await db
            .insert(pendingAnalyses)
            .values({
              userId,
              pipelineResult: { entryMode: 'cheat', spec },
              rawInput: message,
              entryMode: 'cheat',
              loggedAt,
            })
            .returning({ id: pendingAnalyses.id });

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
          traceContext,
          { clarifyAnswer }
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

        // Completeness gate (precise clarify) — MUST run BEFORE the
        // empty_nutrition gate: a meal whose only ingredients are unresolved
        // (e.g. "0 fried chicken") assembles to all-zero macros, and the
        // nutrition gate would swallow the clarify with a generic error.
        // The pipeline finished but ≥1
        // ingredient's portion/match couldn't be resolved. Mirror the cheat
        // clarify early-exit — surface ONE targeted question and stop WITHOUT
        // persisting an incomplete pending_analyses row. The client re-submits
        // with `clarifyAnswer`.
        if (result.unresolved) {
          const tClarify = await getTranslations({
            locale: locale ?? profile.preferredLocale ?? 'en',
            namespace: 'logging.clarify',
          });
          const question =
            result.unresolved.reason === 'ambiguous_food'
              ? tClarify('food', {
                  ingredient: result.unresolved.ingredientName,
                  mealItem: result.unresolved.mealItemName,
                })
              : tClarify('portion', {
                  ingredient: result.unresolved.ingredientName,
                  mealItem: result.unresolved.mealItemName,
                });
          emit({
            type: 'clarify',
            question,
            reason: result.unresolved.reason,
          });
          logPipelineEnd(
            requestId,
            'success',
            Date.now() - startTime,
            db,
            undefined,
            pvu
          );
          return;
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
        const [inserted] = await db
          .insert(pendingAnalyses)
          .values({
            userId,
            pipelineResult: result.data,
            rawInput: message,
            loggedAt,
          })
          .returning({ id: pendingAnalyses.id });

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

        const errorMessage =
          error instanceof Error ? error.message : 'Failed to process meal';
        const isRateLimit = errorMessage.includes('429');

        emit({
          type: 'error',
          code: isRateLimit ? 'rate_limit' : 'internal',
          message: isRateLimit
            ? 'Rate limited — please wait a moment and try again'
            : 'Failed to process meal',
          retryable: !isRateLimit,
        });
      } finally {
        request.signal.removeEventListener('abort', releaseOnAbort);
        await releaseGuard();
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
