import type {
  CheatSlider,
  CheatSliderAnchor,
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

type NutrientKey = 'proteinG' | 'carbohydrateG' | 'fatG' | 'alcoholG';

const NUTRIENT_KEYS: NutrientKey[] = [
  'proteinG',
  'carbohydrateG',
  'fatG',
  'alcoholG',
];

/**
 * The six canonical, evenly-spaced stops every slider resolves to. Levels 0 and
 * 10 are the endpoints; the odd levels 1/3/5/7/9 are the meaningful "between two
 * stops" positions the user can still drag to.
 */
export const CANONICAL_STOP_LEVELS = [0, 2, 4, 6, 8, 10] as const;

/** Clamp a slider level into the valid 0..10 range. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.min(10, Math.max(0, level));
}

/**
 * Re-seed each slider's default to a previously chosen level, reusing the
 * scenario labels/anchors verbatim. Drives "log it again": a repeat card opens
 * on last time's amounts (the user can still nudge — this time may differ).
 */
export function withLevelsAsDefaults(
  spec: CheatSliderSpec,
  levels: CheatSliderLevels
): CheatSliderSpec {
  return {
    ...spec,
    sliders: spec.sliders.map((slider) => ({
      ...slider,
      defaultLevel: clampLevel(levels[slider.key] ?? slider.defaultLevel),
    })),
  };
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

/** The authored anchor closest to `level` (ties resolve to the lower level). */
function nearestAnchorLabel(
  sorted: CheatSliderAnchor[],
  level: number
): string {
  let best = sorted[0];
  let bestDist = Math.abs(best.level - level);
  for (const anchor of sorted) {
    const dist = Math.abs(anchor.level - level);
    if (dist < bestDist) {
      best = anchor;
      bestDist = dist;
    }
  }
  return best.label;
}

/**
 * Resample arbitrary model-authored anchors onto the six canonical stops
 * (levels 0/2/4/6/8/10). Grams per stop come from piecewise-linear
 * interpolation of the source anchors; each stop's label is taken from the
 * nearest authored anchor. Grams are then forced monotonically non-decreasing
 * across stops so "more food" never resolves to fewer grams.
 *
 * This makes the always-visible 6-row UI robust to model drift (too few anchors,
 * odd levels, non-monotonic grams) while leaving the odd in-between levels to
 * interpolate correctly through `interpolateNutrient` at resolve time.
 */
export function canonicalizeAnchors(
  anchors: CheatSliderAnchor[]
): CheatSliderAnchor[] {
  if (anchors.length === 0) {
    return CANONICAL_STOP_LEVELS.map((level) => ({ level, label: '' }));
  }
  const sorted = [...anchors].sort((a, b) => a.level - b.level);

  // Only carry the nutrients this slider actually authored (macro sliders emit
  // one axis; the drinks slider may emit carbs/fat/alcohol).
  const activeNutrients = NUTRIENT_KEYS.filter((key) =>
    sorted.some((anchor) => anchor[key] !== undefined)
  );

  const stops: CheatSliderAnchor[] = CANONICAL_STOP_LEVELS.map((level) => {
    const stop: CheatSliderAnchor = {
      level,
      label: nearestAnchorLabel(sorted, level),
    };
    for (const key of activeNutrients) {
      stop[key] = round1(interpolateNutrient(sorted, level, key));
    }
    return stop;
  });

  // Enforce monotonic non-decreasing grams per nutrient across the stops.
  for (const key of activeNutrients) {
    let prev = 0;
    for (const stop of stops) {
      const value = stop[key] ?? 0;
      if (value < prev) {
        stop[key] = prev;
      } else {
        prev = value;
      }
    }
  }

  return stops;
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
