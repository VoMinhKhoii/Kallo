import { EN_COMPARISONS } from './comparisons-en';
import { VI_COMPARISONS } from './comparisons-vi';

/**
 * The comparisons the "understanding" section puts on display.
 *
 * Every number here came out of the real pipeline. They were captured live on
 * 2026-08-07 against the fixed pipeline (ai-studio, `PIPELINE_MODEL_PROFILE=
 * stable`, neutral profile) by `scripts/eval/capture-landing-v2.ts`, and the
 * raw capture is the source of truth. Nothing is authored, rounded to look
 * better, or nudged to make a point — the section's whole argument is that the
 * estimate really does move, so inventing the movement would defeat it.
 *
 * Only ids and numbers live here. Every visible string is a message key, under
 * `landing.understanding`, because this page speaks Vietnamese too.
 *
 * **Vietnamese and English are different cuisines, not translations.** A
 * Vietnamese visitor sees `fat`, `weight` and `oil`; an English visitor sees
 * `fat`, `weight` and `count`. Each locale shows only pairs verified in that
 * locale — the English oil pair and the Vietnamese count pair both failed
 * review (DEV-96 and DEV-100) and are deliberately absent rather than faked.
 *
 * Two honesty constraints the copy must respect, both learned the hard way:
 *
 *   1. This is one honest sample, not a reproducible benchmark. Call 1 runs at
 *      temperature 0.3 and Call 2 at 0.4, with no seed.
 *   2. The unchanged part of a meal drifts a little between variants, because
 *      the two variants are independent LLM calls and nothing pins the constant.
 *      Every pair below was checked so the headline movement is attributable to
 *      the words the user added — but the copy must never claim that literally
 *      nothing else moved.
 */

/** A derived row inside one variant. `id` resolves under the category's `items`. */
export interface ComparisonItem {
  id: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** One side of a comparison — a meal as the pipeline returned it. */
export interface ComparisonVariant {
  /** Resolves under `landing.understanding.categories.<id>.variants`. */
  id: string;
  items: ComparisonItem[];
}

export interface Comparison {
  /** Resolves under `landing.understanding.categories`. */
  id: string;
  /** Which macro the added words are supposed to move. Drives the delta line. */
  moves: 'fat' | 'protein' | 'carbs';
  /**
   * The painting behind the right-hand card, in the hero's house style.
   *
   * One per comparison, not one per variant. The two sides are the same meal
   * with one detail added — and that detail is precisely what no picture of the
   * meal can show, so a second painting could only differ in ways that have
   * nothing to do with the comparison. Only the right card wears it (see
   * `showArt` in `compare-meal-card.tsx`), which leaves the left as the plain
   * sheet somebody typed on.
   *
   * Locales share a file wherever they share a dish (`fat`, `weight`) and split
   * where the cuisines do (`oil` is bún đậu in Vietnamese, a burger in
   * English), which is why these are set per entry rather than per id.
   */
  art: string;
  /** Exactly two: what people type, then the same thing with a detail added. */
  variants: readonly [ComparisonVariant, ComparisonVariant];
}

export const COMPARISONS_BY_LOCALE: Record<string, readonly Comparison[]> = {
  vi: VI_COMPARISONS,
  en: EN_COMPARISONS,
};

/**
 * The one dish the added words actually moved — the row worth marking.
 *
 * Only the macro named by `moves` is considered, and only its single largest
 * shift. Both restrictions are about honesty rather than tidiness: the two
 * variants are independent model runs, so unrelated rows wobble by a gram or
 * two on their own (see the note at the top of this file), and marking every
 * row that differs would dress that noise up as the point. The largest shift in
 * the claimed macro is the one attributable to the words.
 *
 * Symmetric by construction, so both cards mark the same row and the pair can
 * be read across. Returns null if nothing moved, and nothing is marked.
 *
 * `delta` is signed, after minus before, and is what points the arrow.
 */
export interface ShiftedItem {
  /** The dish that moved, resolving under the category's `items`. */
  id: string;
  /** Signed, after minus before. Its sign is what points the arrow. */
  delta: number;
}

export function shiftedItem(comparison: Comparison): ShiftedItem | null {
  const [before, after] = comparison.variants;
  let best: ShiftedItem | null = null;

  for (const item of after.items) {
    const was = before.items.find((other) => other.id === item.id);
    if (!was) continue;
    const delta = item[comparison.moves] - was[comparison.moves];
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { id: item.id, delta };
    }
  }

  return best && best.delta !== 0 ? best : null;
}

/** Totals summed from the rows, so a card can never disagree with itself. */
export function variantTotals(variant: ComparisonVariant) {
  return variant.items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
