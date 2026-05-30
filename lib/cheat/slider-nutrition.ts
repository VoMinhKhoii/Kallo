import type {
  CheatSlider,
  CheatSliderLevels,
  CheatSliderSpec,
} from '@/lib/types/cheat';

/**
 * Single source of truth for turning chosen slider levels into nutrition.
 * Used both by the client (live preview as sliders move) and the server
 * (authoritative recompute on confirm — never trust client-sent numbers).
 */
export interface ResolvedCheatNutrition {
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  alcoholG: number;
  caloriesKcal: number;
}

const NUTRIENT_KEYS = [
  'proteinG',
  'carbohydrateG',
  'fatG',
  'alcoholG',
] as const;
type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Clamp a slider level into the valid 0..10 range. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.min(10, Math.max(0, level));
}

/** The AI's default position per slider — what an untouched card resolves to. */
export function defaultLevels(spec: CheatSliderSpec): CheatSliderLevels {
  const levels: CheatSliderLevels = {};
  for (const slider of spec.sliders) {
    levels[slider.key] = clampLevel(slider.defaultLevel);
  }
  return levels;
}

/**
 * Piecewise-linear interpolation of one nutrient's grams for a slider at
 * `level`, using its sparse anchors. Anchors should include level 0 and 10;
 * we defensively sort and clamp to the edge values outside the anchor span.
 */
function interpolateNutrient(
  anchors: CheatSlider['anchors'],
  level: number,
  nutrient: NutrientKey
): number {
  if (anchors.length === 0) {
    return 0;
  }
  const target = clampLevel(level);
  const sorted = [...anchors].sort((a, b) => a.level - b.level);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (target <= first.level) {
    return first[nutrient] ?? 0;
  }
  if (target >= last.level) {
    return last[nutrient] ?? 0;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (target >= lo.level && target <= hi.level) {
      const span = hi.level - lo.level;
      if (span <= 0) {
        return hi[nutrient] ?? lo[nutrient] ?? 0;
      }
      const t = (target - lo.level) / span;
      const loVal = lo[nutrient] ?? 0;
      const hiVal = hi[nutrient] ?? 0;
      return loVal + (hiVal - loVal) * t;
    }
  }
  return last[nutrient] ?? 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Resolve total nutrition from chosen slider levels.
 * - Macro sliders contribute only their own nutrient (orthogonal dials).
 * - The drinks slider contributes carbs (sugar) + fat (creamy) + alcohol.
 * - Calories derive from the macro identity 4·P + 4·C + 9·F + 7·alcohol so the
 *   number always agrees with the sliders the user actually set.
 */
export function resolveSliderNutrition(
  spec: CheatSliderSpec,
  levels: CheatSliderLevels
): ResolvedCheatNutrition {
  let proteinG = 0;
  let carbohydrateG = 0;
  let fatG = 0;
  let alcoholG = 0;

  for (const slider of spec.sliders) {
    const level = levels[slider.key] ?? slider.defaultLevel;
    proteinG += interpolateNutrient(slider.anchors, level, 'proteinG');
    carbohydrateG += interpolateNutrient(
      slider.anchors,
      level,
      'carbohydrateG'
    );
    fatG += interpolateNutrient(slider.anchors, level, 'fatG');
    alcoholG += interpolateNutrient(slider.anchors, level, 'alcoholG');
  }

  proteinG = round1(proteinG);
  carbohydrateG = round1(carbohydrateG);
  fatG = round1(fatG);
  alcoholG = round1(alcoholG);

  const caloriesKcal = Math.round(
    4 * proteinG + 4 * carbohydrateG + 9 * fatG + 7 * alcoholG
  );

  return { proteinG, carbohydrateG, fatG, alcoholG, caloriesKcal };
}

/**
 * The active anchor label for a slider at a given level — the nearest anchor
 * at or below the current position. Drives the "you're here" text on the card.
 */
export function activeAnchorLabel(slider: CheatSlider, level: number): string {
  if (slider.anchors.length === 0) {
    return '';
  }
  const target = clampLevel(level);
  const sorted = [...slider.anchors].sort((a, b) => a.level - b.level);
  let label = sorted[0].label;
  for (const anchor of sorted) {
    if (anchor.level <= target) {
      label = anchor.label;
    } else {
      break;
    }
  }
  return label;
}
