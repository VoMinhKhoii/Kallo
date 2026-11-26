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
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type {
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';
import { safeError } from '@/lib/core/errors/safe-error';
import { type HoldResult, MAX_HOLD_FACTOR } from './hold';
import { MAX_READ_KCAL } from './plain-read';
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

function addConstantNutrient(
  bounded: BoundedNutrition,
  displayed: NutritionValues,
  key: 'caloriesKcal' | 'fatG',
  delta: number
): { bounded: BoundedNutrition; displayed: NutritionValues } {
  if (!(delta > 0)) return { bounded, displayed };
  const prevB = bounded[key] ?? { low: 0, mid: 0, high: 0 };
  return {
    bounded: {
      ...bounded,
      [key]: {
        low: prevB.low + delta,
        mid: prevB.mid + delta,
        high: prevB.high + delta,
      },
    },
    displayed: {
      ...displayed,
      [key]: (displayed[key] ?? 0) + delta,
    },
  };
}

function editIngredient(
  ing: ProcessedIngredient,
  grams: number,
  kcal: number
): { updated: ProcessedIngredient; rejected: boolean } {
  const oldGrams = ing.estimatedGrams;
  const oldKcal = ing.displayedNutrition.caloriesKcal ?? 0;
  const tableKcal = ing.boundedNutrition.caloriesKcal?.mid ?? oldKcal;

  // Guard against smuggling non-oil food onto a pure-oil row (e.g. turning
  // cooking oil into 2.7 kcal/g). Use the un-shifted table midpoint so cut/bulk
  // goal adjustments never hide a pure-fat row.
  if (oldGrams > 0 && tableKcal / oldGrams >= PURE_FAT_DENSITY_FLOOR) {
    if (grams > 0 && kcal / grams < PURE_FAT_EDIT_MIN_DENSITY) {
      return { updated: ing, rejected: true };
    }
  }

  const safeGrams = Math.max(0, grams);
  // Hard physics cap: no ingredient can exceed pure fat (9.0 kcal/g), and
  // zero grams always carries zero calories.
  const safeKcal = Math.max(0, Math.min(kcal, safeGrams * MAX_KCAL_PER_GRAM));
  const gramsRatio = oldGrams > 0 ? safeGrams / oldGrams : 0;
  const rawEquivalentGrams =
    oldGrams > 0 ? ing.rawEquivalentGrams * gramsRatio : safeGrams;

  // Without existing calories we have no macro split to lift above 0 kcal,
  // but resizing a 0-kcal row (broth, salt, mineral water) still scales its
  // micronutrients proportionally to grams (and zeroes them at 0 g).
  if (!(oldKcal > 0)) {
    if (safeKcal > 0) return { updated: ing, rejected: true };
    return {
      rejected: false,
      updated: {
        ...ing,
        estimatedGrams: safeGrams,
        rawEquivalentGrams,
        boundedNutrition: scaleBoundedNutrition(
          ing.boundedNutrition,
          gramsRatio
        ),
        displayedNutrition: scaleNutritionValues(
          ing.displayedNutrition,
          gramsRatio
        ),
      },
    };
  }

  const kcalRatio = safeKcal / oldKcal;
  const oldMacroGrams =
    (ing.displayedNutrition.proteinG ?? 0) +
    (ing.displayedNutrition.carbohydrateG ?? 0) +
    (ing.displayedNutrition.fatG ?? 0) +
    (ing.alcoholG ?? 0);

  // If raising calorie density uniformly would push P + C + F + alcohol past
  // the ingredient's physical weight (e.g. fixing a watery row to a creamy/oil
  // sauce), shift the extra density into fat (9 kcal/g) so P + C + F <= grams
  // and bounded/displayed nutrition still commute with goal adjustment.
  let baseScale = kcalRatio;
  let extraFatG = 0;
  let extraKcal = 0;
  if (oldMacroGrams > 0 && kcalRatio * oldMacroGrams > safeGrams) {
    const denom = MAX_KCAL_PER_GRAM * oldMacroGrams - oldKcal;
    if (denom > 1e-6) {
      baseScale = Math.max(
        0,
        (MAX_KCAL_PER_GRAM * safeGrams - safeKcal) / denom
      );
      extraFatG = Math.max(0, safeGrams - baseScale * oldMacroGrams);
      extraKcal = Math.max(0, safeKcal - baseScale * oldKcal);
    } else {
      baseScale = safeGrams / oldMacroGrams;
    }
  }

  let bounded = scaleBoundedNutrition(ing.boundedNutrition, baseScale);
  let displayed = scaleNutritionValues(ing.displayedNutrition, baseScale);
  if (extraFatG > 0 || extraKcal > 0) {
    ({ bounded, displayed } = addConstantNutrient(
      bounded,
      displayed,
      'fatG',
      extraFatG
    ));
    ({ bounded, displayed } = addConstantNutrient(
      bounded,
      displayed,
      'caloriesKcal',
      extraKcal
    ));
  }

  return {
    rejected: false,
    updated: {
      ...ing,
      estimatedGrams: safeGrams,
      rawEquivalentGrams,
      boundedNutrition: bounded,
      displayedNutrition: displayed,
      ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * baseScale }),
    },
  };
}

function applyRescueEditsWithStats(
  raw: PipelineResult,
  edits: RescueOutput['edits']
): { result: PipelineResult; appliedCount: number; rejectedCount: number } {
  if (edits.length === 0) {
    return { result: raw, appliedCount: 0, rejectedCount: 0 };
  }
  const byIndex = new Map(edits.map((e) => [e.index, e]));
  let totalParts = 0;
  for (const mi of raw.mealItems) totalParts += mi.ingredients.length;

  let appliedCount = 0;
  let rejectedCount = 0;
  for (const idx of byIndex.keys()) {
    if (idx < 0 || idx >= totalParts) rejectedCount++;
  }

  let cursor = 0;
  const result = raw.mealItems.reduce((acc, mi, itemIndex) => {
    let item = mi;
    for (const ing of mi.ingredients) {
      const idx = cursor++;
      const edit = byIndex.get(idx);
      if (!edit) continue;
      if (
        ing.typedAmount ||
        !Number.isFinite(edit.grams) ||
        !Number.isFinite(edit.kcal)
      ) {
        rejectedCount++;
        continue;
      }
      const { updated, rejected } = editIngredient(ing, edit.grams, edit.kcal);
      if (rejected) {
        rejectedCount++;
        continue;
      }
      appliedCount++;
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

  return { result, appliedCount, rejectedCount };
}

/**
 * Apply targeted per-ingredient rescue edits to the unheld `raw` pipeline
 * result. Locked (`typedAmount`) ingredients are never touched, physical
 * calorie-density and macro-mass bounds are enforced, and dish/meal totals
 * stay in sync.
 */
export function applyRescueEdits(
  raw: PipelineResult,
  edits: RescueOutput['edits']
): PipelineResult {
  return applyRescueEditsWithStats(raw, edits).result;
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

    const {
      result: rescued,
      appliedCount,
      rejectedCount,
    } = applyRescueEditsWithStats(args.raw, output.edits);

    // If the model requested edits and every edit was rejected by guards, do
    // not ship the unheld meal as rescued — fall back to the single-factor hold.
    if (output.edits.length > 0 && appliedCount === 0 && rejectedCount > 0) {
      return null;
    }

    const rescuedParts = rescued.mealItems.flatMap((mi) => mi.ingredients);
    // Sum directly from ingredients to avoid IEEE-754 subtraction residue from
    // `swapNutritionValues` defeating the minimum-calorie sanity gate.
    const rescuedKcal = rescuedParts.reduce(
      (sum, ing) => sum + (ing.displayedNutrition.caloriesKcal ?? 0),
      0
    );
    const rescuedGrams = rescuedParts.reduce(
      (sum, ing) => sum + ing.estimatedGrams,
      0
    );

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

    const rawGrams = args.raw.mealItems
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
