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
  /** Exactly two: what people type, then the same thing with a detail added. */
  variants: readonly [ComparisonVariant, ComparisonVariant];
}

const VI: readonly Comparison[] = [
  {
    id: 'fat',
    moves: 'fat',
    variants: [
      {
        id: 'plain',
        items: [
          {
            id: 'rice',
            grams: 200,
            calories: 302,
            protein: 6,
            carbs: 68,
            fat: 1,
          },
          {
            id: 'thigh',
            grams: 155,
            calories: 311,
            protein: 36,
            carbs: 0,
            fat: 19,
          },
          {
            id: 'soup',
            grams: 550,
            calories: 81,
            protein: 5,
            carbs: 12,
            fat: 1,
          },
        ],
      },
      {
        id: 'trimmed',
        items: [
          {
            id: 'rice',
            grams: 200,
            calories: 302,
            protein: 6,
            carbs: 68,
            fat: 1,
          },
          {
            id: 'thigh',
            grams: 155,
            calories: 270,
            protein: 36,
            carbs: 0,
            fat: 14,
          },
          {
            id: 'soup',
            grams: 450,
            calories: 67,
            protein: 5,
            carbs: 10,
            fat: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'oil',
    moves: 'fat',
    variants: [
      {
        id: 'fried',
        items: [
          {
            id: 'bun',
            grams: 410,
            calories: 530,
            protein: 22,
            carbs: 51,
            fat: 27,
          },
        ],
      },
      {
        id: 'noOil',
        items: [
          {
            id: 'bun',
            grams: 450,
            calories: 346,
            protein: 21,
            carbs: 52,
            fat: 6,
          },
        ],
      },
    ],
  },
  {
    id: 'weight',
    moves: 'protein',
    variants: [
      {
        id: 'asEaten',
        items: [
          {
            id: 'breast',
            grams: 300,
            calories: 429,
            protein: 87,
            carbs: 0,
            fat: 9,
          },
          {
            id: 'potato',
            grams: 150,
            calories: 179,
            protein: 1,
            carbs: 43,
            fat: 0,
          },
          {
            id: 'salad',
            grams: 120,
            calories: 108,
            protein: 1,
            carbs: 3,
            fat: 10,
          },
        ],
      },
      {
        id: 'raw',
        items: [
          {
            id: 'breast',
            grams: 300,
            calories: 330,
            protein: 60,
            carbs: 13,
            fat: 5,
          },
          {
            id: 'potato',
            grams: 150,
            calories: 179,
            protein: 1,
            carbs: 43,
            fat: 0,
          },
          {
            id: 'salad',
            grams: 125,
            calories: 108,
            protein: 1,
            carbs: 3,
            fat: 10,
          },
        ],
      },
    ],
  },
];

const EN: readonly Comparison[] = [
  {
    id: 'fat',
    moves: 'fat',
    variants: [
      {
        id: 'plain',
        items: [
          {
            id: 'rice',
            grams: 200,
            calories: 302,
            protein: 6,
            carbs: 68,
            fat: 1,
          },
          {
            id: 'thigh',
            grams: 157,
            calories: 329,
            protein: 36,
            carbs: 0,
            fat: 21,
          },
          {
            id: 'greens',
            grams: 150,
            calories: 27,
            protein: 2,
            carbs: 4,
            fat: 0,
          },
        ],
      },
      {
        id: 'trimmed',
        items: [
          {
            id: 'rice',
            grams: 200,
            calories: 302,
            protein: 6,
            carbs: 68,
            fat: 1,
          },
          {
            id: 'thigh',
            grams: 125,
            calories: 219,
            protein: 29,
            carbs: 0,
            fat: 12,
          },
          {
            id: 'greens',
            grams: 150,
            calories: 27,
            protein: 2,
            carbs: 4,
            fat: 0,
          },
        ],
      },
    ],
  },
  {
    id: 'count',
    moves: 'carbs',
    variants: [
      {
        id: 'one',
        items: [
          {
            id: 'rice',
            grams: 200,
            calories: 302,
            protein: 6,
            carbs: 68,
            fat: 1,
          },
          {
            id: 'pork',
            grams: 180,
            calories: 354,
            protein: 30,
            carbs: 0,
            fat: 26,
          },
        ],
      },
      {
        id: 'two',
        items: [
          {
            id: 'rice',
            grams: 400,
            calories: 604,
            protein: 13,
            carbs: 136,
            fat: 1,
          },
          {
            id: 'pork',
            grams: 170,
            calories: 282,
            protein: 30,
            carbs: 0,
            fat: 18,
          },
        ],
      },
    ],
  },
  {
    id: 'weight',
    moves: 'protein',
    variants: [
      {
        id: 'asEaten',
        items: [
          {
            id: 'breast',
            grams: 300,
            calories: 429,
            protein: 87,
            carbs: 0,
            fat: 9,
          },
          {
            id: 'potato',
            grams: 150,
            calories: 179,
            protein: 1,
            carbs: 43,
            fat: 0,
          },
          {
            id: 'salad',
            grams: 100,
            calories: 18,
            protein: 1,
            carbs: 3,
            fat: 0,
          },
        ],
      },
      {
        id: 'raw',
        items: [
          {
            id: 'breast',
            grams: 300,
            calories: 325,
            protein: 70,
            carbs: 0,
            fat: 5,
          },
          {
            id: 'potato',
            grams: 150,
            calories: 137,
            protein: 3,
            carbs: 31,
            fat: 0,
          },
          {
            id: 'salad',
            grams: 150,
            calories: 28,
            protein: 2,
            carbs: 5,
            fat: 0,
          },
        ],
      },
    ],
  },
  {
    // The capture also holds a middle `pan-fried potatoes` variant, and across
    // all three the calories are NOT monotonic (936 → 1002 → 804). Only the two
    // ends are shown, and they are shown knowing that `fries` and `air-fried
    // potatoes` match two different pre-fried composition rows, so part of this
    // movement is the row choice rather than the words. DEV-96 tracks the fix.
    id: 'oil',
    moves: 'fat',
    variants: [
      {
        id: 'fried',
        items: [
          {
            id: 'potatoes',
            grams: 208,
            calories: 457,
            protein: 5,
            carbs: 46,
            fat: 28,
          },
          {
            id: 'burger',
            grams: 185,
            calories: 479,
            protein: 35,
            carbs: 30,
            fat: 24,
          },
        ],
      },
      {
        id: 'noOil',
        items: [
          {
            id: 'potatoes',
            grams: 200,
            calories: 370,
            protein: 4,
            carbs: 50,
            fat: 17,
          },
          {
            id: 'burger',
            grams: 180,
            calories: 434,
            protein: 28,
            carbs: 30,
            fat: 22,
          },
        ],
      },
    ],
  },
];

export const COMPARISONS_BY_LOCALE: Record<string, readonly Comparison[]> = {
  vi: VI,
  en: EN,
};

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
