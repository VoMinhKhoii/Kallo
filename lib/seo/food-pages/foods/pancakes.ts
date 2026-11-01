import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'diner',
      label: 'Diner stack with butter and syrup',
      text: 'Diner pancakes (stack of 3 buttermilk pancakes + 1 tablespoon butter + 3 tablespoons maple syrup)',
    },
    {
      key: 'bacon',
      label: 'Two pancakes with bacon',
      text: '2 buttermilk pancakes + 2 strips of bacon + a drizzle of maple syrup',
    },
    {
      key: 'berries',
      label: 'Homemade, berries and honey',
      text: '3 small homemade pancakes with fresh berries and 1 tablespoon of honey, no butter',
    },
    {
      key: 'protein',
      label: 'Protein pancakes with yogurt',
      text: 'Protein pancakes (1 scoop whey protein + 1 banana + 2 eggs + 30g oats) with 100g Greek yogurt on top',
    },
  ],
  copy: {
    name: 'Pancakes',
    title: 'How many calories are in pancakes?',
    metaTitle: 'Calories in Pancakes: 4 Real Breakfasts',
    description: (span) =>
      `From about ${span} kcal. Four real pancake breakfasts, from a diner stack with butter and syrup to protein pancakes, broken down by what is on the plate.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The batter matters less than the stack height and what you pour on it. Here are four real pancake breakfasts, each typed into Kallo the way people describe them.`,
    breakdownOf: 'diner',
    breakdownLead:
      'In the diner stack, the pancakes themselves are two thirds of the plate. The syrup and the butter add another 266 kcal on top.',
    tryLine:
      'Type yours the way you would say it, like “two pancakes, a little syrup, no butter”, and Kallo works out the rest.',
  },
};
