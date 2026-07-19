import type { GeminiClient } from '@/lib/ai/gemini';
import type { buildUserContext } from '@/lib/ai/mappers';
import type { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { NON_FOOD_BLOCKLIST } from '@/lib/ai/pipeline/errors';
import { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/ids';
import { ingredientDisplayName } from '@/lib/ai/pipeline/ingredient-accessors';
import { mealDecompositionSchema } from '@/lib/ai/pipeline/schemas';
import { getDecompositionPromptBuilder } from '@/lib/ai/prompts';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

import { DEBUG_LLM_TIMEOUT_MS, serializeAttempt } from './debug-shared';

/**
 * Step 1: decomposition LLM call with raw response + attempt capture.
 *
 * NOTE (v1 surface): this debug step still exercises the V1 prompt + schema,
 * while production defaults to the v2 grounded pipeline — useful only for
 * debugging the v1 fallback path. Porting the whole debug route to v2 (all
 * steps consume the v1 decomposition shape) is tracked in DEV-91.
 */
export async function runDecompositionDebugStep({
  gemini,
  modelProfile,
  userContext,
  input,
}: {
  gemini: GeminiClient;
  modelProfile: ReturnType<typeof resolveModelProfile>;
  userContext: ReturnType<typeof buildUserContext>;
  input: string;
}) {
  let decomposition: ReturnType<typeof ensureIdsOnDecomposition> | null = null;
  const s1Start = Date.now();
  const step1: Record<string, any> = {
    prompt: null,
    rawResponse: null,
    parsed: null,
    attempts: [],
    durationMs: 0,
    error: null,
  };

  try {
    const decompositionPromptBuilder = getDecompositionPromptBuilder();
    const systemPrompt = decompositionPromptBuilder(userContext);
    step1.prompt = systemPrompt;

    let rawResponse = '';
    const parsed = await fetchWithTimeout(
      (signal) =>
        gemini.generateStructuredOutputStream(
          {
            schema: mealDecompositionSchema,
            systemPrompt,
            userMessage: input,
            model: modelProfile.decompositionModel,
            temperature: 0.3,
            topP: 1,
            topK: 1,
            abortSignal: signal,
          },
          {
            onChunk: (accumulated) => {
              rawResponse = accumulated;
            },
            onAttemptComplete: (metadata) => {
              step1.attempts.push(serializeAttempt(metadata));
            },
          }
        ),
      DEBUG_LLM_TIMEOUT_MS,
      'debug-decomposition'
    );
    step1.rawResponse = rawResponse;
    decomposition = ensureIdsOnDecomposition(parsed);
    step1.parsed = decomposition;

    if (!decomposition.isFood) {
      step1.error = 'LLM classified input as non-food (isFood=false)';
    }

    const blocked = decomposition.mealItems
      .flatMap((item) =>
        item.ingredients.map((i) => ingredientDisplayName(i).toLowerCase())
      )
      .filter((n) => NON_FOOD_BLOCKLIST.has(n));

    if (blocked.length > 0) {
      step1.error = `Blocklisted terms found: ${blocked.join(', ')}`;
    }
  } catch (err) {
    step1.error = err instanceof Error ? err.message : String(err);
  }

  step1.durationMs = Date.now() - s1Start;
  return { step1, decomposition };
}
