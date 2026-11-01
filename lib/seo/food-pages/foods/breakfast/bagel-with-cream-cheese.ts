import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'deli',
      label: 'Deli bagel, thick spread',
      text: 'Bagel with cream cheese from a deli (1 large plain bagel + a thick layer of cream cheese)',
    },
    {
      key: 'lox',
      label: 'Everything bagel with lox',
      text: 'Everything bagel + cream cheese + 60g smoked salmon + capers + red onion',
    },
    {
      key: 'half-light',
      label: 'Half a bagel, light cream cheese',
      text: 'Half a plain bagel, toasted, with 1 tablespoon of light cream cheese',
    },
    {
      key: 'veg',
      label: 'Whole wheat with tomato and cucumber',
      text: 'Whole wheat bagel + 2 tablespoons of cream cheese + sliced tomato + cucumber',
    },
  ],
  copy: {
    name: 'Bagel with cream cheese',
    title: 'How many calories are in a bagel with cream cheese?',
    metaTitle: 'Calories in a Bagel with Cream Cheese: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real bagels, from a deli bagel with a thick spread to half a bagel with light cream cheese, broken down part by part.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The bagel is most of it; the spread is less than people think. Here are four real bagels, each typed into Kallo the way people describe them.`,
    breakdownOf: 'deli',
    breakdownLead:
      'In the deli bagel, the bagel is almost three quarters of the calories. The cream cheese everyone worries about is 109 kcal.',
    tryLine:
      'Type yours the way you would say it, like “half an everything bagel, thin layer of cream cheese”, and Kallo works out the rest.',
  },
};
