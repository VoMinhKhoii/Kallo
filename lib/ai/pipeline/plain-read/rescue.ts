/**
 * Outlier-only "seeing" rescue for the plain-read hold (`hold.ts`).
 *
 * On ~83% of meals, the blind plain read's calorie and gram multipliers agree
 * closely, so `holdToPlainRead` finishes in 0 ms with a single density-preserving
 * multiplier. On the remaining ~17% where calories and grams diverge sharply
 * (`>= RESCUE_DIVERGENCE_THRESHOLD`), this module lets Sonnet inspect the actual
 * ingredient table and make targeted per-ingredient fixes under hard physics
 * and locked-part invariants.
 */
import {
  replaceMealItem,
  scaleBoundedNutrition,
  scaleNutritionValues,
  swapBoundedNutrition,
  swapNutritionValues,
} from '@/lib/ai/pipeline/assemble/result-scale';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import type {
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';
import { safeError } from '@/lib/core/errors/safe-error';
import type { HoldResult } from './hold';
import type { PlainRead, PlainReadProfile } from './prompt';
import {
  buildRescueUserMessage,
  RESCUE_DIVERGENCE_THRESHOLD,
  RESCUE_MODEL,
  RESCUE_SYSTEM_PROMPT,
  RESCUE_TIMEOUT_MS,
  type RescueOutput,
  rescueSchema,
} from './rescue-prompt';

/** Physical ceiling: pure fat is ~9 kcal/g; nothing in food can exceed this. */
const MAX_KCAL_PER_GRAM = 9.0;
/** Rows at or above this density are pure fats/oils and must keep their real density. */
const PURE_FAT_DENSITY_FLOOR = 8.0;
/** Minimum density allowed when editing a pure-fat row (blocks smuggling non-oil food onto oil). */
const PURE_FAT_EDIT_MIN_DENSITY = 7.5;

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

function editIngredient(
  ing: ProcessedIngredient,
  grams: number,
  kcal: number
): ProcessedIngredient {
  const oldGrams = ing.estimatedGrams;
  const oldKcal = ing.displayedNutrition.caloriesKcal ?? 0;
  const tableKcal = ing.boundedNutrition.caloriesKcal?.mid ?? oldKcal;

  // Guard against smuggling non-oil food onto a pure-oil row (e.g. turning
  // cooking oil into 2.7 kcal/g). Use the un-shifted table midpoint so cut/bulk
  // goal adjustments never hide a pure-fat row.
  if (oldGrams > 0 && tableKcal / oldGrams >= PURE_FAT_DENSITY_FLOOR) {
    if (grams > 0 && kcal / grams < PURE_FAT_EDIT_MIN_DENSITY) {
      return ing;
    }
  }

  const safeGrams = Math.max(0, grams);
  // Hard physics cap: no ingredient can exceed pure fat (9.0 kcal/g), and
  // zero grams always carries zero calories.
  const safeKcal = Math.max(0, Math.min(kcal, safeGrams * MAX_KCAL_PER_GRAM));

  // Without existing calories we have no macro proportions to scale safely.
  if (!(oldKcal > 0)) {
    if (safeKcal > 0) return ing;
    const rawEquivalentGrams =
      oldGrams > 0
        ? ing.rawEquivalentGrams * (safeGrams / oldGrams)
        : safeGrams;
    return { ...ing, estimatedGrams: safeGrams, rawEquivalentGrams };
  }

  const kcalRatio = safeKcal / oldKcal;
  const rawEquivalentGrams =
    oldGrams > 0 ? ing.rawEquivalentGrams * (safeGrams / oldGrams) : safeGrams;

  return {
    ...ing,
    estimatedGrams: safeGrams,
    rawEquivalentGrams,
    boundedNutrition: scaleBoundedNutrition(ing.boundedNutrition, kcalRatio),
    displayedNutrition: scaleNutritionValues(ing.displayedNutrition, kcalRatio),
    ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * kcalRatio }),
  };
}

/**
 * Apply targeted per-ingredient rescue edits to the unheld `raw` pipeline
 * result. Locked (`typedAmount`) ingredients are never touched, physical
 * calorie-density bounds are enforced, and dish/meal totals stay in sync.
 */
export function applyRescueEdits(
  raw: PipelineResult,
  edits: RescueOutput['edits']
): PipelineResult {
  if (edits.length === 0) return raw;
  const byIndex = new Map(edits.map((e) => [e.index, e]));

  let cursor = 0;
  return raw.mealItems.reduce((acc, mi, itemIndex) => {
    let item = mi;
    for (const ing of mi.ingredients) {
      const idx = cursor++;
      const edit = byIndex.get(idx);
      if (!edit || ing.typedAmount) continue;
      if (!Number.isFinite(edit.grams) || !Number.isFinite(edit.kcal)) continue;
      const updated = editIngredient(ing, edit.grams, edit.kcal);
      if (updated === ing) continue;
      item = {
        ...item,
        ingredients: item.ingredients.map((cur) =>
          cur === ing ? updated : cur
        ),
        boundedNutrition: swapBoundedNutrition(
          item.boundedNutrition,
          ing.boundedNutrition,
          updated.boundedNutrition
        ),
        displayedNutrition: swapNutritionValues(
          item.displayedNutrition,
          ing.displayedNutrition,
          updated.displayedNutrition
        ),
      };
    }
    return item === mi ? acc : replaceMealItem(acc, itemIndex, item);
  }, raw);
}

/**
 * Run the seeing rescue on a divergent meal. Returns a `HoldResult` with
 * `outcome: 'rescued'`, or `null` on timeout / abort / failure so the caller
 * falls back cleanly to the density-safe `holdToPlainRead` result.
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

  const controller = new AbortController();
  const cancel = () => controller.abort();
  args.signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, RESCUE_TIMEOUT_MS);

  try {
    const output = await args.gemini.generateStructuredOutput(
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
        abortSignal: controller.signal,
      },
      args.onAttemptComplete
        ? { onAttemptComplete: args.onAttemptComplete }
        : undefined
    );

    if (args.signal.aborted) return null;

    const rescued = applyRescueEdits(args.raw, output.edits);
    const rescuedKcal = rescued.displayedNutrition.caloriesKcal ?? 0;
    // Sanity gate: never let a rescue zero out a meal that had calories.
    if (!(rescuedKcal > 0)) return null;

    const appKcal = args.hold.appKcal;
    const rawGrams = args.raw.mealItems
      .flatMap((mi) => mi.ingredients)
      .reduce((g, ing) => g + ing.estimatedGrams, 0);
    const rescuedGrams = rescued.mealItems
      .flatMap((mi) => mi.ingredients)
      .reduce((g, ing) => g + ing.estimatedGrams, 0);

    return {
      result: rescued,
      outcome: 'rescued',
      appKcal,
      readKcal: args.hold.readKcal,
      factor: appKcal && appKcal > 0 ? rescuedKcal / appKcal : 1,
      gramsFactor: rawGrams > 0 ? rescuedGrams / rawGrams : 1,
      rawGramsFactor: args.hold.rawGramsFactor,
    };
  } catch (err) {
    if (!args.signal.aborted) {
      console.warn('[plain-read-rescue] rescue failed:', safeError(err));
    }
    return null;
  } finally {
    clearTimeout(timer);
    args.signal.removeEventListener('abort', cancel);
  }
}
