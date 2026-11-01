import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'cafe',
      label: 'Café, bacon and hash browns',
      text: 'Breakfast burrito from a café (large flour tortilla + 3 scrambled eggs + bacon + hash browns + cheddar cheese + salsa)',
    },
    {
      key: 'sausage',
      label: 'Sausage and sour cream',
      text: 'Breakfast burrito (flour tortilla + 2 scrambled eggs + pork sausage + cheese + sour cream)',
    },
    {
      key: 'veggie',
      label: 'Veggie, no cheese',
      text: 'Veggie breakfast burrito (flour tortilla + 2 scrambled eggs + black beans + peppers + onion + salsa, no cheese)',
    },
    {
      key: 'homemade',
      label: 'Homemade, egg whites',
      text: 'Homemade breakfast burrito (1 small whole wheat tortilla + 2 egg whites + 1 whole egg + 30g turkey bacon + a bit of cheese)',
    },
  ],
  copy: {
    name: 'Breakfast burrito',
    title: 'How many calories are in a breakfast burrito?',
    metaTitle: 'Calories in a Breakfast Burrito: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real breakfast burritos, from a cafe one with bacon and hash browns to a homemade egg-white wrap, broken down by filling.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Eggs and a tortilla are the base; potatoes, cheese and meat are what stack up. Here are four real breakfast burritos, each typed into Kallo the way people describe them.`,
    breakdownOf: 'cafe',
    breakdownLead:
      'In the cafe burrito, three eggs and the tortilla are half of it. The hash browns and the cheddar add another 281 kcal between them.',
    tryLine:
      'Type yours the way you would say it, like “breakfast burrito, two eggs, no potatoes, a bit of cheese”, and Kallo works out the rest.',
  },
};
