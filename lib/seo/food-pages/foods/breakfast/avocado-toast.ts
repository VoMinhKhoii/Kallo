import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'cafe',
      label: 'Café, two slices',
      text: 'Avocado toast from a cafe (2 slices of sourdough + 1 whole avocado smashed + olive oil drizzle + chili flakes)',
    },
    {
      key: 'poached-egg',
      label: 'One slice with a poached egg',
      text: 'Avocado toast (1 slice of sourdough + half an avocado + 1 poached egg + a pinch of salt)',
    },
    {
      key: 'feta',
      label: 'Whole wheat, feta and tomatoes',
      text: 'Avocado toast (2 slices of whole wheat toast + half an avocado + a bit of feta + cherry tomatoes)',
    },
    {
      key: 'rye',
      label: 'Rye, a quarter avocado, no oil',
      text: 'Avocado toast on 1 slice of rye bread (a quarter of an avocado + lemon juice + black pepper, no oil)',
    },
  ],
  copy: {
    name: 'Avocado toast',
    title: 'How many calories are in avocado toast?',
    metaTitle: 'Calories in Avocado Toast: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real avocado toasts, two slices at a cafe, one with a poached egg, whole wheat with feta and a light rye slice.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The bread and how much avocado goes on it decide the number. Here are four real toasts, each typed into Kallo the way people describe them.`,
    breakdownOf: 'cafe',
    breakdownLead:
      'In the cafe toast, the two slices of sourdough are just over half of it. A whole avocado adds 177 kcal.',
    tryLine:
      'Type yours the way you would say it, like “avocado toast, one slice of sourdough, half an avocado, an egg”, and Kallo works out the rest.',
  },
};
