import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'salads',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, full dressing',
      text: 'Chicken Caesar salad from a restaurant (romaine + grilled chicken + croutons + shaved parmesan + about 3 tablespoons of Caesar dressing)',
    },
    {
      key: 'wrap',
      label: 'Caesar wrap from a café',
      text: 'Chicken Caesar wrap from a café (large flour tortilla + grilled chicken + romaine + parmesan + Caesar dressing)',
    },
    {
      key: 'no-croutons',
      label: 'No croutons, light dressing',
      text: 'Chicken Caesar salad (romaine + grilled chicken + a bit of parmesan + 1 tablespoon of Caesar dressing, no croutons)',
    },
    {
      key: 'homemade',
      label: 'Homemade, weighed chicken',
      text: 'Homemade chicken Caesar salad (2 handfuls of romaine + 120g grilled chicken breast + 1 tablespoon light Caesar dressing + 1 tablespoon grated parmesan + a few croutons)',
    },
  ],
  copy: {
    name: 'Chicken Caesar salad',
    title: 'How many calories are in a chicken Caesar salad?',
    metaTitle: 'Calories in a Chicken Caesar Salad: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken Caesar salads, a restaurant one with full dressing, a cafe wrap, a lighter bowl without croutons and a weighed homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A Caesar is a salad in name; the dressing, the croutons and the cheese decide its number. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant salad, the dressing is the biggest line at 244 kcal, more than the chicken. The croutons add 120.',
    tryLine:
      'Type yours the way you would say it, like “chicken Caesar, dressing on the side, used half, no croutons”, and Kallo works out the rest.',
  },
};
