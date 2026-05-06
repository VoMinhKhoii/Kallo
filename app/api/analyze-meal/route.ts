import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { createGeminiClient } from '@/lib/ai/gemini';
import { buildUserContext, toParsedMeal } from '@/lib/ai/mappers';
import { logUnmatchedIngredients } from '@/lib/ai/matching';
import { analyzeMeal } from '@/lib/ai/pipeline';
import { logPipelineEnd, logPipelineStart } from '@/lib/ai/pipeline/logging';
import type { StreamEvent } from '@/lib/ai/streaming';
import { encodeSSE } from '@/lib/ai/streaming';
import { db } from '@/lib/db';
import {
  analysisGuardEvents,
  pendingAnalyses,
  userProfiles,
} from '@/lib/db/schema';
import { Errors, serializeError } from '@/lib/errors';
import {
  type AnalysisGuardAllowedResult,
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
} from '@/lib/rate-limit/analysis-guards';
import { createClient } from '@/lib/supabase/server';
import { mealMessageSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const analyzeMealRoute = '/api/analyze-meal';

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();

  return forwardedIp || request.headers.get('x-real-ip');
}

function createGuardRelease(release: AnalysisGuardAllowedResult['release']) {
  let released = false;

  return async () => {
    if (!release || released) return;
    released = true;

    try {
      await release();
    } catch (error) {
      console.error('[analyze-meal] Failed to release analysis guard:', error);
    }
  };
}

/**
 * Pre-stream validation: auth, input, profile, config.
 * Returns structured JSON error responses before SSE starts.
 *
 * Auth verification and body parsing run in parallel to reduce latency by
 * ~50-100ms on each request (saves one sequential network round-trip).
 */
async function validateRequest(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Parallelize auth and body parsing — independent operations
    const [authResult, bodyResult] = await Promise.allSettled([
      supabase.auth.getUser(),
      request.json() as Promise<unknown>,
    ]);

    // Validate auth — getUser() can resolve with { data: { user: null }, error: AuthError }
    if (
      authResult.status === 'rejected' ||
      authResult.value.error ||
      !authResult.value.data.user
    ) {
      throw Errors.notAuthenticated();
    }
    const user = authResult.value.data.user;

    // Validate body parse
    if (bodyResult.status === 'rejected') {
      throw Errors.validationFailed('Invalid JSON in request body');
    }
    const body = bodyResult.value;

    // Fetch profile (requires user.id from auth above)
    const rows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);
    const profile = rows[0];
    if (!profile) {
      throw Errors.profileNotFound();
    }

    const parsed = mealMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.validationFailed(
        parsed.error.issues[0]?.message ?? 'Invalid input'
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw Errors.internal();
    }

    return {
      data: {
        userId: user.id,
        message: parsed.data.message,
        profile,
        apiKey,
      },
    };
  } catch (error) {
    return { error: serializeError(error) };
  }
}

export async function POST(request: NextRequest) {
  // Phase 1: Pre-stream validation — errors returned as JSON
  const validation = await validateRequest(request);
  if (validation.error) return validation.error;
  const { userId, message, profile, apiKey } = validation.data;

  const userContext = buildUserContext(profile);
  const ip = getRequestIp(request);

  const guard = await checkAnalysisGuards({
    userId,
    ip,
    route: analyzeMealRoute,
    db,
  });

  if (!guard.allowed) {
    await db.insert(analysisGuardEvents).values(
      buildAnalysisGuardEvent({
        userId,
        ip,
        route: analyzeMealRoute,
        reason: guard.reason,
        retryAfterSeconds: guard.retryAfterSeconds,
      })
    );

    return Response.json(Errors.rateLimited().toJSON(), {
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

        const gemini = createGeminiClient(apiKey);
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

        // Emit final display result
        emit({ type: 'result', data: meal });

        // Store full pipeline result durably for later confirmation
        const [inserted] = await db
          .insert(pendingAnalyses)
          .values({
            userId,
            pipelineResult: result.data,
            rawInput: message,
          })
          .returning({ id: pendingAnalyses.id });

        // Terminal event — analysis stored, safe to confirm
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
