import type { NextRequest } from 'next/server';
import { createGeminiClient } from '@/lib/ai/gemini';
import { buildUserContext, toParsedMeal } from '@/lib/ai/mappers';
import { logUnmatchedIngredients } from '@/lib/ai/matching';
import { analyzeMeal } from '@/lib/ai/pipeline';
import type { StreamEvent } from '@/lib/ai/streaming';
import { encodeSSE } from '@/lib/ai/streaming';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { pendingAnalyses } from '@/lib/db/schema';
import { Errors, serializeError } from '@/lib/errors';
import { mealMessageSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Pre-stream validation: auth, input, profile, config.
 * Returns structured JSON error responses before SSE starts.
 * On success, returns the validated context needed for the pipeline.
 */
async function validateRequest(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthAndProfile();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw Errors.validationFailed('Invalid JSON in request body');
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

  // Phase 2: Stream pipeline results as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };

      try {
        const gemini = createGeminiClient(apiKey);
        const result = await analyzeMeal(
          message,
          buildUserContext(profile),
          db,
          gemini,
          emit
        );

        // Check for abort after pipeline completes
        if (request.signal.aborted) {
          return;
        }

        if (!result.success) {
          console.error(
            '[analyze-meal] Pipeline returned error:',
            result.error.type,
            result.error.message
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
            input: message,
          });
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

        // Fire-and-forget: log unmatched ingredients
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
