import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'comfort',
  meals: [
    {
      key: 'chip-shop',
      label: 'Chip shop, large, tartar sauce',
      text: 'Fish and chips from a chip shop (large battered cod + large portion of chips) with tartar sauce',
    },
    {
      key: 'mushy-peas',
      label: 'Haddock with mushy peas',
      text: 'Fish and chips (battered haddock + regular portion of chips + mushy peas)',
    },
    {
      key: 'small',
      label: 'Small, no sauce',
      text: 'Small fish and chips (small battered cod + small portion of chips), no sauce',
    },
    {
      key: 'oven',
      label: 'Homemade, oven-baked',
      text: 'Homemade fish and chips (150g breaded cod baked in the oven + 200g oven chips) with ketchup',
    },
  ],
  copy: {
    name: 'Fish and chips',
    title: 'How many calories are in fish and chips?',
    metaTitle: 'Calories in Fish and Chips: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real portions of fish and chips, a large one from a chip shop, haddock with mushy peas, a small portion and an oven-baked homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The fish is lean; the batter, the frying oil and the size of the chips portion are what count. Here are four real portions, each typed into Kallo the way people describe them.`,
    breakdownOf: 'chip-shop',
    breakdownLead:
      'At the chip shop, the large portion of chips is the biggest line at 418 kcal, more than the fish. The batter adds 178.',
    tryLine:
      'Type yours the way you would say it, like “small cod and chips, mushy peas, no sauce”, and Kallo works out the rest.',
  },
};
