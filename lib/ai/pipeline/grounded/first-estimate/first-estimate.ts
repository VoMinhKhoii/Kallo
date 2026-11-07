/**
 * The model's own read of the meal, before it sees a database row: the meal
 * text alone, asked the way a person asks a chatbot. Call 2 keeps that read and
 * uses the rows to identify foods and split dishes, which stopped its grams
 * drifting away from a plain answer (held-out meals, 2026-11-07).
 *
 * It starts beside Call 1, so it costs one small call and almost no wait. It
 * can only help: a late or failed estimate leaves Call 2 as it was.
 * `FIRST_ESTIMATE_ENABLED=true` turns it on.
 */

import { z } from 'zod';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';

/** How long Call 2 waits for an estimate that is still running. */
const GRACE_MS = 1_500;
/** Past this the call is cut off, whether or not anyone is waiting. */
const TIMEOUT_MS = 12_000;

const firstEstimateSchema = z.object({
  foods: z.array(
    z.object({ name: z.string(), grams: z.number(), kcal: z.number() })
  ),
  totalKcal: z.number(),
});
type FirstEstimate = z.infer<typeof firstEstimateSchema>;

export function isFirstEstimateEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv('FIRST_ESTIMATE_ENABLED', false, env);
}

/** One line per food, for the Call 2 prompt. */
export function renderFirstEstimate(estimate: FirstEstimate): string {
  const foods = estimate.foods.map(
    (f) => `- ${f.name}: ${Math.round(f.grams)} g, ${Math.round(f.kcal)} kcal`
  );
  return [...foods, `Total about ${Math.round(estimate.totalKcal)} kcal.`].join(
    '\n'
  );
}

export function startFirstEstimate(args: {
  gemini: GeminiClient;
  model: string;
  mealText: string;
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}): {
  settle: () => Promise<string | undefined>;
  abort: () => void;
} {
  const controller = new AbortController();
  const cutOff = setTimeout(() => controller.abort(), TIMEOUT_MS);
  cutOff.unref?.();
  const answer = args.gemini
    .generateStructuredOutput(
      {
        schema: firstEstimateSchema,
        systemPrompt: 'You are a helpful assistant.',
        userMessage: `This is what I ate:\n\n${args.mealText}\n\nHow much did I eat? List each food with its grams and calories, then the total calories.`,
        model: args.model,
        abortSignal: controller.signal,
      },
      args.onAttemptComplete
        ? { onAttemptComplete: args.onAttemptComplete }
        : undefined
    )
    .then((estimate) =>
      estimate.foods.length > 0 ? renderFirstEstimate(estimate) : undefined
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
