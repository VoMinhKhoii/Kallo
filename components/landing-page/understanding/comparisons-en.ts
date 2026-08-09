import type { Comparison } from './comparisons';

/**
 * The English pairs, captured from the real pipeline — see `comparisons.ts`
 * for the provenance and the two things the copy is not allowed to claim.
 *
 * A separate file from the Vietnamese ones because these are a different
 * cuisine rather than a translation: braised pork where Vietnamese has none.
 *
 * There is no English `oil` pair. It was dropped at review — 936 → 1002 → 804
 * kcal, not monotonic, because `fries` and `air-fried potatoes` match three
 * different pre-fried composition rows, so most of the movement is the row
 * choice rather than the words (DEV-96, recorded in DEV-105). It was shipped
 * here by mistake for a while, with the caveat noted in a code comment nobody
 * reading the page could see. A pair whose movement we cannot attribute to the
 * user's words is the one thing this section must not show.
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
];
