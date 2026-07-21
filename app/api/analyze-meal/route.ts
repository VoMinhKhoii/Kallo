import { sql } from 'drizzle-orm';
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
import { withDeadline } from '@/lib/with-deadline';
import {
  createGuardRelease,
  getRequestIp,
  validateRequest,
} from './request-validation';
import { toStreamErrorEvent } from './stream-errors';
import { emitUnresolvedOutcome } from './unresolved-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

const analyzeMealRoute = '/api/analyze-meal';

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
          const [insertedCheat] = await withDeadline(
            db
              .insert(pendingAnalyses)
              .values({
                userId,
                pipelineResult: { entryMode: 'cheat', spec },
                rawInput: message,
                entryMode: 'cheat',
                loggedAt,
                attemptId,
              })
              // Supersede the same attempt's prior row (e.g. a cheat-clarify
              // re-run) rather than orphaning it — see the precise path below.
              .onConflictDoUpdate({
                target: [pendingAnalyses.userId, pendingAnalyses.attemptId],
                set: {
                  pipelineResult: { entryMode: 'cheat', spec },
                  rawInput: message,
                  entryMode: 'cheat',
                  loggedAt,
                  expiresAt: sql`now() + interval '30 minutes'`,
                },
              })
              .returning({ id: pendingAnalyses.id }),
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
          await emitUnresolvedOutcome({
            unresolved: result.unresolved,
            locale: locale ?? profile.preferredLocale ?? 'en',
            emit,
            requestId,
            db,
            startTime,
            promptVersionsUsed: pvu,
          });
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
        const [inserted] = await withDeadline(
          db
            .insert(pendingAnalyses)
            .values({
              userId,
              pipelineResult: result.data,
              rawInput: message,
              loggedAt,
              attemptId,
            })
            // Re-analyzing the same attempt (cheat-clarify, retry) upserts this
            // row instead of orphaning it. NULL attemptId can't conflict (NULLs
            // are distinct), so it always inserts. Refresh expiresAt so the
            // renewed card gets a full window.
            .onConflictDoUpdate({
              target: [pendingAnalyses.userId, pendingAnalyses.attemptId],
              set: {
                pipelineResult: result.data,
                rawInput: message,
                entryMode: 'precise',
                loggedAt,
                expiresAt: sql`now() + interval '30 minutes'`,
              },
            })
            .returning({ id: pendingAnalyses.id }),
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
