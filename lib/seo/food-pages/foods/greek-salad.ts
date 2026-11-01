import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'salads',
  meals: [
    {
      key: 'taverna',
      label: 'Taverna, slab of feta',
      text: 'Greek salad at a taverna (tomatoes + cucumber + red onion + green pepper + olives + a slab of feta + olive oil)',
    },
    {
      key: 'chicken',
      label: 'With grilled chicken',
      text: 'Greek salad with grilled chicken (tomatoes + cucumber + olives + feta + red onion + Greek dressing)',
    },
    {
      key: 'lemon',
      label: 'A bit of feta, lemon not oil',
      text: 'Greek salad (tomatoes + cucumber + red onion + olives + a bit of feta) with lemon juice instead of oil',
    },
    {
      key: 'side',
      label: 'Small side salad',
      text: 'Small side Greek salad with feta and olive oil dressing',
    },
  ],
  copy: {
    name: 'Greek salad',
    title: 'How many calories are in a Greek salad?',
    metaTitle: 'Calories in a Greek Salad: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real Greek salads, a taverna plate with a slab of feta, one with grilled chicken, a light one with lemon and a side salad.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The vegetables are almost free; the feta and the olive oil are where a Greek salad is. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'taverna',
    breakdownLead:
      'In the taverna salad, the feta and the olive oil are almost three quarters of it. The tomatoes, pepper, cucumber and onion together are about 50 kcal.',
    tryLine:
      'Type yours the way you would say it, like “Greek salad, half the feta, a drizzle of olive oil”, and Kallo works out the rest.',
  },
};
