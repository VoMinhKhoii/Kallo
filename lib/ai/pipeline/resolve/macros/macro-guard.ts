/**
 * Bounded-triple algebra and the hallucination guard.
 *
 * Every macro the pipeline ships is a `{low, mid, high}` triple. This module
 * owns the arithmetic on those triples (scale, derive kcal from the 4/4/9
 * identity, flatten to a server anchor) and the one rule that decides whether
 * an LLM-emitted triple may be trusted: `guardMacro`.
 *
 * It knows nothing about ingredients, DB rows or prep notes — callers supply
 * the anchor and the permitted ratio. `bounded-macros.ts` is where those
 * per-ingredient policy decisions live.
 */

import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';

export const HALLUCINATION_GUARD_RATIO = 3;

/**
 * Tighter, prep-notes-aware bands used when the user typed verbatim
 * preparation modifiers (e.g. "bỏ da", "bỏ mỡ", "nước trong", "extra oil").
 *
 * Rationale (see plan): prep notes describe *minor* macro tweaks on the SAME
 * matched food. Quantity goes to `grams`; identity changes go to
 * `canonicalName`; ingredient removals go to the ingredients list. So a
 * sensible prep-note swing tops out around 2× fat (omelette w/ or w/o oil)
 * and ~1.4× P/C. The fat band is asymmetric in spirit but configured as a
 * symmetric ratio of 2 (covers both `bỏ da bỏ mỡ` → 0.5× and `extra oil`
 * → 2×). Worst-case kcal swing ≈ (P×1.4 + C×1.4 + F×2) / base ≈ 1.5–1.7×.
 */
export const PREP_NOTES_FAT_MAX_RATIO = 2;
export const PREP_NOTES_PC_MAX_RATIO = 1.4;

/**
 * Server-anchored flat triple: low = mid = high = value. Used wherever we
 * derive a definite DB-anchored number (matched protein, matched carb, or an
 * invalid LLM triple). The value is exact from
 * `base = DB per_100g × dbScalingGrams / 100`, so the low/high bounds carry
 * no additional information — emitting a spread would actively distort
 * downstream goal-adjusted displays (e.g., a cutting user would otherwise
 * see protein.low at 85 % of the DB truth).
 */
export function flatTriple(value: number): BoundedEstimate {
  const v = Math.max(0, value);
  return { low: v, mid: v, high: v };
}

/**
 * Detect a structurally-invalid bounded triple from the LLM: NaN/Infinity,
 * negative, or unordered (low > mid, mid > high, low > high). Used by the
 * fat guard to fall back to base when the LLM emits garbage.
 */
export function isStructurallyInvalidTriple(t: BoundedEstimate): boolean {
  for (const v of [t.low, t.mid, t.high]) {
    if (!Number.isFinite(v) || v < 0) return true;
  }
  return t.low > t.mid || t.mid > t.high || t.low > t.high;
}

export function scaleBounded(
  b: BoundedEstimate,
  factor: number
): BoundedEstimate {
  return {
    low: Math.max(0, b.low * factor),
    mid: Math.max(0, b.mid * factor),
    high: Math.max(0, b.high * factor),
  };
}

/**
 * Derive calories from the macro identity 4P + 4C + 9F, per bound. Always
 * preferred over the LLM's caloriesKcal mid because the macros themselves
 * are now structurally consistent (P/C server-anchored, F LLM-adjusted with
 * 3× guard) — keeping kcal in lockstep eliminates the macro_inconsistent
 * anomaly class entirely for matched ingredients.
 */
export function deriveCaloriesFromMacros(
  protein: BoundedEstimate,
  carb: BoundedEstimate,
  fat: BoundedEstimate
): BoundedEstimate {
  return {
    low: 4 * protein.low + 4 * carb.low + 9 * fat.low,
    mid: 4 * protein.mid + 4 * carb.mid + 9 * fat.mid,
    high: 4 * protein.high + 4 * carb.high + 9 * fat.high,
  };
}

/**
 * Apply the hallucination guard to a macro. Structurally invalid triples fall
 * back to the server anchor. Ordered triples outside the permitted envelope
 * are scaled to the nearest bound, preserving low <= mid <= high and the
 * LLM's relative uncertainty instead of discarding the estimate.
 *
 * `maxRatio` defaults to `HALLUCINATION_GUARD_RATIO` (3) for the legacy
 * fat-only path; callers pass tighter prep-notes ratios when applying the
 * guard to protein/carb/fat under user-typed modifiers.
 */
export function guardMacro(
  raw: BoundedEstimate,
  base: number,
  ingredientName: string,
  macroName: string,
  maxRatio: number = HALLUCINATION_GUARD_RATIO,
  ceilingAddend: number = 0
): BoundedEstimate {
  if (isStructurallyInvalidTriple(raw)) {
    console.warn(
      `[nutrition] hallucination_guard: replaced invalid ${macroName} of "${ingredientName}" with base=${base.toFixed(1)} (reason=invalid, raw mid=${raw.mid}, low=${raw.low}, high=${raw.high})`
    );
    return flatTriple(base);
  }
  const safeAddend =
    Number.isFinite(ceilingAddend) && ceilingAddend > 0 ? ceilingAddend : 0;
  if (base <= 0 && safeAddend === 0) {
    // No usable DB anchor or additive allowance. Trust a structurally sane
    // triple rather than manufacturing a zero for a nutrient the DB lacks.
    return raw;
  }
  const floor = base > 0 ? base / maxRatio : 0;
  const ceiling = Math.max(0, base) * maxRatio + safeAddend;
  const target = raw.mid > ceiling ? ceiling : raw.mid < floor ? floor : null;

  // Scale first so the LLM's relative uncertainty survives, then hold every
  // bound inside the envelope.
  //
  // Both steps are needed. Scaling alone leaves `high` proportionally out of
  // range, and a `mid` that is already inside the envelope used to return the
  // triple untouched no matter how far `high` overshot. That mattered because
  // the displayed number is not always `mid`: goal adjustment computes
  // `mid + aggression × (goal_bound − mid)` (`goal-adjustment.ts:42`), so a
  // cutting user at full aggression is shown `high` outright. A ceiling that
  // bounds only `mid` is not a ceiling on anything the user actually reads.
  //
  // Clamping is monotone, so `low <= mid <= high` is preserved.
  const scale = target !== null && raw.mid > 0 ? target / raw.mid : null;
  const scaled =
    target === null
      ? raw
      : scale === null
        ? flatTriple(target)
        : scaleBounded(raw, scale);

  const hold = (v: number) => Math.min(Math.max(v, floor), ceiling);
  const bounded = {
    low: hold(scaled.low),
    mid: hold(scaled.mid),
    high: hold(scaled.high),
  };

  if (
    bounded.low === raw.low &&
    bounded.mid === raw.mid &&
    bounded.high === raw.high
  ) {
    return raw;
  }
  const reason =
    target === null
      ? 'bounds_outside_envelope'
      : raw.mid > ceiling
        ? 'overshoot'
        : 'undershoot';
  console.warn(
    `[nutrition] hallucination_guard: clamped ${macroName} of "${ingredientName}" to ${bounded.mid.toFixed(1)} (reason=${reason}, raw mid=${raw.mid}, low=${raw.low}, high=${raw.high}, base=${base.toFixed(1)}, maxRatio=${maxRatio}, ceilingAddend=${safeAddend.toFixed(1)}, envelope=[${floor.toFixed(1)}, ${ceiling.toFixed(1)}])`
  );
  return bounded;
}
