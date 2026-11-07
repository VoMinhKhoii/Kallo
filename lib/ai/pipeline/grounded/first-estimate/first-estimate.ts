/**
 * The model's own read of the meal, before it sees a database row: the meal
 * text alone, asked the way a person asks a chatbot. Plain answers landed
 * closer to the truth than row × grams, because a wrong row or a split dish
 * can price a meal far off. Its total does not replace the parts; it only holds
 * them near a sane meal (`./hold-near`), so rows and reasons stay.
 *
 * It starts beside Call 1 and is read after Call 2, so it costs one small call
 * and almost no wait. A late or failed estimate leaves the meal as it was.
 * `FIRST_ESTIMATE_ENABLED=true` turns it on.
 */

import { z } from 'zod';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';

/** How long the review waits for an estimate that is still running. */
const GRACE_MS = 1_500;
/** Past this the call is cut off, whether or not anyone is waiting. */
const TIMEOUT_MS = 12_000;

const firstEstimateSchema = z.object({
  foods: z.array(
    z.object({ name: z.string(), grams: z.number(), kcal: z.number() })
  ),
  totalKcal: z.number(),
});

const SYSTEM_PROMPT = 'You are a helpful assistant.';
const userMessage = (mealText: string): string =>
  `This is what I ate:\n\n${mealText}\n\nHow much did I eat? List each food with its grams and calories, then the total calories.`;

export function isFirstEstimateEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv('FIRST_ESTIMATE_ENABLED', false, env);
}

export function startFirstEstimate(args: {
  gemini: GeminiClient;
  model: string;
  mealText: string;
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}): {
  /** The meal's kcal, or undefined when the estimate failed or came late. */
  settle: () => Promise<number | undefined>;
  abort: () => void;
} {
  const controller = new AbortController();
  const cutOff = setTimeout(() => controller.abort(), TIMEOUT_MS);
  cutOff.unref?.();
  const answer = args.gemini
    .generateStructuredOutput(
      {
        schema: firstEstimateSchema,
        systemPrompt: SYSTEM_PROMPT,
        userMessage: userMessage(args.mealText),
        model: args.model,
        abortSignal: controller.signal,
      },
      args.onAttemptComplete
        ? { onAttemptComplete: args.onAttemptComplete }
        : undefined
    )
    .then((estimate) =>
      estimate.foods.length > 0 && estimate.totalKcal > 0
        ? estimate.totalKcal
        : undefined
    )
    .catch((err: unknown) => {
      if (!controller.signal.aborted)
        console.warn('[first-estimate] failed', err);
      return undefined;
    })
    .finally(() => clearTimeout(cutOff));

  return {
    async settle() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), GRACE_MS);
      });
      const estimate = await Promise.race([answer, late]);
      clearTimeout(timer);
      controller.abort();
      return estimate;
    },
    abort: () => controller.abort(),
  };
}
