/**
 * Outlier-only "seeing" rescue for the plain-read hold (`../hold.ts`).
 *
 * On ~83% of meals, the blind plain read's calorie and gram multipliers agree
 * closely, so `holdToPlainRead` finishes in 0 ms with a single density-preserving
 * multiplier. On the remaining ~17% where calories and grams diverge sharply
 * (`>= RESCUE_DIVERGENCE_THRESHOLD`), this module lets Sonnet inspect the actual
 * ingredient table and make targeted per-ingredient fixes under hard physics
 * and locked-part invariants.
 */
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import type { PipelineResult } from '@/lib/ai/types/result';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import { safeError } from '@/lib/core/errors/safe-error';
import { type HoldResult, MAX_HOLD_FACTOR } from '../hold';
import { MAX_READ_KCAL } from '../plain-read';
import type { PlainRead, PlainReadProfile } from '../prompt';
import { applyRescueEdits } from './apply-edits';
import {
  buildRescueUserMessage,
  RESCUE_DIVERGENCE_THRESHOLD,
  RESCUE_MODEL,
  RESCUE_SYSTEM_PROMPT,
  RESCUE_TIMEOUT_MS,
  rescueSchema,
} from './prompt';

/** Hard mass ceiling for a rescued meal (10 kg) against hallucinated edits. */
const MAX_RESCUED_GRAMS = 10_000;

/** Ratio between the calorie multiplier and the raw read-implied grams multiplier. */
export function holdDivergence(factor: number, rawGramsFactor: number): number {
  if (!(factor > 0) || !(rawGramsFactor > 0)) return 1;
  return Math.max(factor / rawGramsFactor, rawGramsFactor / factor);
}

/** Whether a hold result warrants the seeing rescue call. */
export function shouldRunSeeingRescue(hold: HoldResult): boolean {
  if (!readBooleanEnv('PLAIN_READ_RESCUE_ENABLED', true)) return false;
  if (hold.outcome !== 'held' && hold.outcome !== 'within_band') return false;
  return (
    holdDivergence(hold.factor, hold.rawGramsFactor) >=
    RESCUE_DIVERGENCE_THRESHOLD
  );
}

function sumFreeParts(result: PipelineResult): { kcal: number; grams: number } {
  let kcal = 0;
  let grams = 0;
  for (const mi of result.mealItems) {
    for (const ing of mi.ingredients) {
      if (ing.typedAmount) continue;
      kcal += ing.displayedNutrition.caloriesKcal ?? 0;
      grams += ing.estimatedGrams;
    }
  }
  return { kcal, grams };
}

/**
 * Run the seeing rescue on a divergent meal. Returns a `HoldResult` with
 * `outcome: 'rescued'`, or `null` on timeout / abort / rejected edits / failure
 * so the caller falls back cleanly to the density-safe `holdToPlainRead` result.
 */
export async function runSeeingRescue(args: {
  raw: PipelineResult;
  read: PlainRead;
  hold: HoldResult;
  mealText: string;
  profile: PlainReadProfile;
  gemini: GeminiClient;
  signal: AbortSignal;
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}): Promise<HoldResult | null> {
  if (args.signal.aborted) return null;

  try {
    const output = await fetchWithTimeout(
      (abortSignal) =>
        args.gemini.generateStructuredOutput(
          {
            schema: rescueSchema,
            systemPrompt: RESCUE_SYSTEM_PROMPT,
            userMessage: buildRescueUserMessage({
              mealText: args.mealText,
              profile: args.profile,
              raw: args.raw,
              read: args.read,
              factor: args.hold.factor,
              rawGramsFactor: args.hold.rawGramsFactor,
            }),
            model: RESCUE_MODEL,
            abortSignal,
          },
          args.onAttemptComplete
            ? { onAttemptComplete: args.onAttemptComplete }
            : undefined
        ),
      RESCUE_TIMEOUT_MS,
      'plain_read_rescue',
      args.signal
    );

    if (args.signal.aborted) return null;

    const { result: rescued, appliedCount } = applyRescueEdits(
      args.raw,
      output.edits
    );

    // If the model requested edits and none survived validation/guards, do not
    // ship the unheld meal as rescued — fall back to the single-factor hold.
    if (output.edits.length > 0 && appliedCount === 0) return null;

    const rescuedKcal = rescued.displayedNutrition.caloriesKcal ?? 0;
    const rescuedGrams = rescued.mealItems
      .flatMap((mi) => mi.ingredients)
      .reduce((sum, ing) => sum + ing.estimatedGrams, 0);

    const appKcal = args.hold.appKcal;
    const referenceCeiling =
      Math.max(appKcal ?? 0, args.hold.readKcal ?? 0) * MAX_HOLD_FACTOR;
    const maxAllowedKcal =
      referenceCeiling > 0
        ? Math.min(MAX_READ_KCAL, referenceCeiling)
        : MAX_READ_KCAL;

    if (
      !(rescuedKcal >= 1) ||
      rescuedKcal > maxAllowedKcal ||
      rescuedGrams > MAX_RESCUED_GRAMS
    ) {
      return null;
    }

    // Match `HoldResult`'s unlocked-part ratio contract (`hold.ts`).
    const rawFree = sumFreeParts(args.raw);
    const rescuedFree = sumFreeParts(rescued);

    return {
      result: rescued,
      outcome: 'rescued',
      appKcal,
      readKcal: args.hold.readKcal,
      factor: rawFree.kcal > 0 ? rescuedFree.kcal / rawFree.kcal : 1,
      gramsFactor: rawFree.grams > 0 ? rescuedFree.grams / rawFree.grams : 1,
      rawGramsFactor: args.hold.rawGramsFactor,
    };
  } catch (err) {
    if (!args.signal.aborted) {
      console.warn('[plain-read-rescue] rescue failed:', safeError(err));
    }
    return null;
  }
}
