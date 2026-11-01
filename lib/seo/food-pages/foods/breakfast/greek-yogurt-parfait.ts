import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'coffee-shop',
      label: 'Coffee shop parfait',
      text: 'Greek yogurt parfait from a coffee shop (vanilla Greek yogurt + granola + mixed berries + honey)',
    },
    {
      key: 'full-fat',
      label: 'Full-fat yogurt, granola, honey',
      text: '200g full-fat Greek yogurt + 30g granola + 1 tablespoon honey + blueberries',
    },
    {
      key: 'nonfat',
      label: 'Nonfat, no granola',
      text: '170g nonfat Greek yogurt + strawberries + 1 tablespoon chia seeds, no granola',
    },
    {
      key: 'walnuts',
      label: 'Walnuts, banana, maple syrup',
      text: 'Greek yogurt bowl (150g 2% Greek yogurt + a handful of walnuts + 1 sliced banana + a drizzle of maple syrup)',
    },
  ],
  copy: {
    name: 'Greek yogurt parfait',
    title: 'How many calories are in a Greek yogurt parfait?',
    metaTitle: 'Calories in a Greek Yogurt Parfait: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real Greek yogurt bowls, full-fat, nonfat and from a coffee shop, broken down by yogurt, granola and toppings.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Which yogurt you pick matters, and so does the granola on top. Here are four real yogurt bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'coffee-shop',
    breakdownLead:
      'In the coffee shop parfait, 30 g of granola carries as many calories as the whole cup of yogurt under it.',
    tryLine:
      'Type yours the way you would say it, like “Greek yogurt, a handful of granola, some berries”, and Kallo works out the rest.',
  },
};
