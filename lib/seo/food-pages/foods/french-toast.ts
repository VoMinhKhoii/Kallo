import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'diner',
      label: 'Diner, brioche and syrup',
      text: 'French toast at a diner (3 thick slices of brioche + butter + maple syrup + powdered sugar)',
    },
    {
      key: 'bacon',
      label: 'Two slices with bacon',
      text: '2 slices of French toast + 2 strips of bacon + maple syrup',
    },
    {
      key: 'berries',
      label: 'Strawberries and whipped cream',
      text: 'French toast (2 slices of white bread dipped in egg and milk, cooked in butter) with strawberries and a bit of whipped cream',
    },
    {
      key: 'light',
      label: 'Whole wheat, no syrup',
      text: 'Homemade French toast (2 slices of whole wheat bread + 1 egg + a splash of milk, cooked with cooking spray) with cinnamon, no syrup',
    },
  ],
  copy: {
    name: 'French toast',
    title: 'How many calories are in French toast?',
    metaTitle: 'Calories in French Toast: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of French toast, from diner brioche with syrup to a light homemade one, broken down by bread, butter and toppings.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The bread decides most of it, and brioche is not sandwich bread. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'diner',
    breakdownLead:
      'At the diner, three thick slices of brioche are more than half of the plate before any butter or syrup goes on.',
    tryLine:
      'Type yours the way you would say it, like “two slices of French toast, a bit of syrup”, and Kallo works out the rest.',
  },
};
