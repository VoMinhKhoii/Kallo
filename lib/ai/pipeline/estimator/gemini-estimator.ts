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

import {
  findUnanchoredNullMacros,
  type GroundedEstimation,
  groundedEstimationSchema,
  groundedEstimationStrictSchema,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { buildGroundedEstimationPrompt } from '@/lib/ai/prompts/build/grounded-estimation';
import type { GeminiClient } from '@/lib/ai/provider/provider';
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
      const request = (schema: typeof groundedEstimationSchema) =>
        gemini.generateStructuredOutputStream(
          {
            schema,
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
      let estimation: GroundedEstimation = await request(
        groundedEstimationSchema
      );
      // Lean output sends null P/C on accepted matches. A null on a row with
      // NO accepted candidate leaves it without a macro source; re-asking the
      // same prompt repeats the null, so re-ask once with the strict schema,
      // whose decoder cannot emit it (see the schema module's LEAN note).
      const unanchored = findUnanchoredNullMacros(estimation);
      if (unanchored.length > 0) {
        console.warn(
          `[call2] lean output left ${unanchored.length} unanchored row(s) without P/C (${unanchored
            .map((u) => u.ingredientName)
            .join(', ')}); re-asking with the strict schema`
        );
        estimation = await request(groundedEstimationStrictSchema);
      }
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
