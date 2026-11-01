import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'peanut-butter',
      label: 'Whole milk, peanut butter, banana',
      text: 'Oatmeal (60g rolled oats cooked in whole milk + 1 tablespoon peanut butter + 1 sliced banana)',
    },
    {
      key: 'coffee-shop',
      label: 'Coffee shop, brown sugar and nuts',
      text: 'Oatmeal from a coffee shop with brown sugar, raisins and mixed nuts',
    },
    {
      key: 'water',
      label: 'Water, blueberries, honey',
      text: '40g dry rolled oats cooked with water + a handful of blueberries + a drizzle of honey',
    },
    {
      key: 'overnight',
      label: 'Overnight oats with yogurt',
      text: 'Overnight oats (50g oats + 150ml almond milk + 1 tablespoon chia seeds + 100g Greek yogurt + strawberries)',
    },
  ],
  copy: {
    name: 'Oatmeal',
    title: 'How many calories are in oatmeal?',
    metaTitle: 'Calories in Oatmeal: 4 Real Bowls',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of oatmeal, with whole milk and peanut butter, from a coffee shop, made with water and as overnight oats.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Oats are the steady part; the milk, the nut butter and the sweetener are what a bowl is made of. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'peanut-butter',
    breakdownLead:
      'In the bowl made with whole milk, the milk adds 150 kcal and one spoon of peanut butter 102. Together they are more than the oats.',
    tryLine:
      'Type yours the way you would say it, like “oatmeal, 50g oats, half milk half water, a spoon of honey”, and Kallo works out the rest.',
  },
};
