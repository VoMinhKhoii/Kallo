import type { Comparison } from './comparisons';

/**
 * The Vietnamese pairs, captured from the real pipeline — see `comparisons.ts`
 * for the provenance and the two things the copy is not allowed to claim.
 *
 * A separate file from the English ones because these are a different cuisine
 * rather than a translation, and because each locale shows only the pairs
 * verified in that locale: the Vietnamese `count` pair failed review (DEV-100)
 * and is absent here rather than faked.
 */
export const VI_COMPARISONS: readonly Comparison[] = [
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
    art: '/landing/meals/compare-oil-vi.webp',
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
