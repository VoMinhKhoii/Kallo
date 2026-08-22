import type { Comparison } from './comparisons';

/**
 * The English pairs, captured from the real pipeline — see `comparisons.ts`
 * for the provenance and the two things the copy is not allowed to claim.
 *
 * A separate file from the Vietnamese ones because these are a different
 * cuisine rather than a translation: a burger and fries where Vietnamese has
 * bún đậu, braised pork where it has none.
 *
 * Four pairs where Vietnamese has three. The extra one is `count`, which the
 * Vietnamese capture failed to produce cleanly (DEV-100).
 */
export const EN_COMPARISONS: readonly Comparison[] = [
  {
    id: 'fat',
    moves: 'fat',
    art: '/landing/meals/compare-fat.webp',
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
    art: '/landing/meals/compare-count.webp',
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
    art: '/landing/meals/compare-weight.webp',
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
    art: '/landing/meals/compare-oil-en.webp',
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
