/**
 * Gemini adapter for the Call-2 grounded-estimation seam.
 *
 * Behavior-preserving wrap of the logic that lived inline in
 * `grounded-orchestrator.ts` (build the grounded-estimation system prompt →
 * `gemini.generateStructuredOutputStream` with `groundedEstimationSchema` →
 * parsed `GroundedEstimation`). The orchestrator's golden test asserts this
 * round-trips identically to the pre-refactor call.
 *
 * This adapter does NOT own the wall-clock deadline: the orchestrator wraps
 * `estimate` in the shared `fetchWithTimeout(NUTRITION_TIMEOUT_MS)` and hands
 * the resulting `AbortSignal` in, exactly as the inline call did.
 */

import type { GeminiClient } from '@/lib/ai/gemini';
import {
  type GroundedEstimation,
  groundedEstimationSchema,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { buildGroundedEstimationPrompt } from '@/lib/ai/prompts/grounded-estimation';
import type {
  GroundedEstimator,
  GroundedEstimatorInput,
  GroundedEstimatorResult,
  GroundedEstimatorStreamHooks,
} from './types';

/** The Call-2 user message — identical bytes to the pre-refactor inline call. */
export const GROUNDED_ESTIMATION_USER_MESSAGE =
  'Verify each candidate (CRAG verdict), estimate grossG then refusePct scoped to the selected candidate state, and emit bounded macros per the rules above.';

export function getGroundedEstimationUserMessage(): string {
  return GROUNDED_ESTIMATION_USER_MESSAGE;
}

export function createGeminiEstimator(
  gemini: GeminiClient,
  model: string
): GroundedEstimator {
  return {
    id: 'gemini',
    model,
    async estimate(
      input: GroundedEstimatorInput,
      abortSignal: AbortSignal,
      hooks?: GroundedEstimatorStreamHooks
    ): Promise<GroundedEstimatorResult> {
      const systemPrompt = buildGroundedEstimationPrompt({
        originalPrompt: input.originalPrompt,
        mealItems: input.mealItems,
        userContext: input.userContext,
      });
      const estimation: GroundedEstimation =
        await gemini.generateStructuredOutputStream(
          {
            schema: groundedEstimationSchema,
            systemPrompt,
            userMessage: getGroundedEstimationUserMessage(),
            model,
            temperature: input.temperature,
            topP: 1,
            topK: 1,
            abortSignal,
          },
          {
            ...(hooks?.onAttemptStart
              ? { onAttemptStart: hooks.onAttemptStart }
              : {}),
            ...(hooks?.onChunk ? { onChunk: hooks.onChunk } : {}),
            ...(hooks?.trace ? { trace: hooks.trace } : {}),
            ...(hooks?.onAttemptComplete
              ? { onAttemptComplete: hooks.onAttemptComplete }
              : {}),
          }
        );
      return { estimation };
    },
  };
}

/**
 * Render the Call-2 system prompt for a given input without invoking the
 * provider — used by the orchestrator to measure `promptCharsCall2` and by the
 * LLM-stage trace builder. Kept here so the prompt-construction ownership
 * stays inside the adapter layer.
 */
export function renderGeminiEstimatorPrompt(
  input: GroundedEstimatorInput
): string {
  return buildGroundedEstimationPrompt({
    originalPrompt: input.originalPrompt,
    mealItems: input.mealItems,
    userContext: input.userContext,
  });
}
