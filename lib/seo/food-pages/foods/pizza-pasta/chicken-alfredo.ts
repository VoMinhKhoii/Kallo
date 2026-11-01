import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, with garlic bread',
      text: 'Chicken fettuccine alfredo at an Italian restaurant (fettuccine + grilled chicken + alfredo sauce + parmesan) with garlic bread',
    },
    {
      key: 'no-bread',
      label: 'No garlic bread',
      text: 'Chicken alfredo (fettuccine + grilled chicken + alfredo sauce), no garlic bread',
    },
    {
      key: 'jar',
      label: 'Penne with jarred sauce',
      text: 'Chicken alfredo with jarred sauce (100g dry penne + half a jar of alfredo sauce + 100g chicken breast)',
    },
    {
      key: 'light',
      label: 'Homemade, light sauce',
      text: 'Homemade light chicken alfredo (80g dry fettuccine + 120g chicken breast + sauce made with milk, 1 tablespoon cream cheese and parmesan)',
    },
  ],
  copy: {
    name: 'Chicken alfredo',
    title: 'How many calories are in chicken alfredo?',
    metaTitle: 'Calories in Chicken Alfredo: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of chicken alfredo, from a restaurant plate with garlic bread to a light homemade sauce made with milk.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The pasta portion, the sauce and the bread on the side are what move it. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the restaurant, the pasta is the biggest line at 311 kcal. The bread on the side adds 245, more than the alfredo sauce itself.',
    tryLine:
      'Type yours the way you would say it, like “chicken alfredo, half the pasta, no garlic bread”, and Kallo works out the rest.',
  },
};
