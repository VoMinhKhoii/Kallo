import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'shop',
      label: 'Falafel shop, hummus and tahini',
      text: 'Falafel wrap from a falafel shop (large pita + 5 falafel balls + hummus + tahini + salad + pickles)',
    },
    {
      key: 'fries',
      label: 'Fries and garlic sauce inside',
      text: 'Falafel wrap (pita + 4 falafel + fries inside + garlic sauce + salad)',
    },
    {
      key: 'plate',
      label: 'Plate with tabbouleh',
      text: 'Falafel plate (4 falafel + hummus + tabbouleh + 1 pita bread)',
    },
    {
      key: 'baked',
      label: 'Homemade, baked falafel',
      text: 'Homemade falafel wrap (1 whole wheat wrap + 4 baked falafel + salad + 1 tablespoon tahini)',
    },
  ],
  copy: {
    name: 'Falafel wrap',
    title: 'How many calories are in a falafel wrap?',
    metaTitle: 'Calories in a Falafel Wrap: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real falafel meals, a shop wrap with hummus and tahini, a wrap with fries inside, a falafel plate and a baked homemade wrap.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Falafel is fried, and the sauces around it are rich too. Here are four real falafel meals, each typed into Kallo the way people describe them.`,
    breakdownOf: 'shop',
    breakdownLead:
      'In the shop wrap, five falafel are the biggest line at 426 kcal. The hummus and tahini add 278, more than the pita.',
    tryLine:
      'Type yours the way you would say it, like “falafel wrap, three falafel, tahini on the side”, and Kallo works out the rest.',
  },
};
