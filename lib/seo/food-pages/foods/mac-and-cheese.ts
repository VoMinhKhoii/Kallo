import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, big bowl',
      text: 'Mac and cheese at a restaurant, big bowl (elbow pasta + cheddar cheese sauce + breadcrumb topping)',
    },
    {
      key: 'box',
      label: 'Boxed, ate half the box',
      text: 'Boxed mac and cheese, made with butter and milk, I ate half the box',
    },
    {
      key: 'broccoli',
      label: 'With broccoli mixed in',
      text: 'Mac and cheese with broccoli (80g dry macaroni + cheddar cheese sauce + 100g steamed broccoli)',
    },
    {
      key: 'homemade',
      label: 'Homemade, skim milk',
      text: 'Homemade mac and cheese (80g dry macaroni + 40g sharp cheddar + 100ml skim milk + 1 teaspoon butter)',
    },
  ],
  copy: {
    name: 'Mac and cheese',
    title: 'How many calories are in mac and cheese?',
    metaTitle: 'Calories in Mac and Cheese: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real servings of mac and cheese, a restaurant bowl, half a box, one with broccoli and a homemade one with skim milk.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The pasta is the steady part; how much cheese and butter go into the sauce is what changes. Here are four real servings, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant bowl, the pasta is nearly half of it. The cheddar sauce adds 261 kcal and the breadcrumb topping only 39.',
    tryLine:
      'Type yours the way you would say it, like “mac and cheese, about a cup, made with skim milk”, and Kallo works out the rest.',
  },
};
