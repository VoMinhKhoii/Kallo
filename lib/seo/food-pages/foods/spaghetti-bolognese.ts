import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'restaurant',
      label: 'Italian restaurant, big plate',
      text: 'Spaghetti bolognese at an Italian restaurant (big plate of spaghetti + beef bolognese sauce + parmesan on top)',
    },
    {
      key: 'homemade',
      label: 'Homemade, lean beef',
      text: 'Homemade spaghetti bolognese (100g dry spaghetti + 120g lean beef mince + tomato sauce + onion + 1 teaspoon olive oil)',
    },
    {
      key: 'small',
      label: 'Small portion, no cheese',
      text: 'Spaghetti bolognese, small portion (1 cup cooked spaghetti + 1 ladle of beef bolognese sauce, no cheese)',
    },
    {
      key: 'zucchini',
      label: 'Turkey sauce on zucchini noodles',
      text: 'Turkey bolognese on zucchini noodles (150g turkey mince + tomato sauce + 2 spiralized zucchini + a bit of parmesan)',
    },
  ],
  copy: {
    name: 'Spaghetti bolognese',
    title: 'How many calories are in spaghetti bolognese?',
    metaTitle: 'Calories in Spaghetti Bolognese: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of spaghetti bolognese, a big restaurant plate, a lean homemade one, a small portion and a turkey sauce on zucchini noodles.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The amount of pasta on the plate is the biggest lever, then the meat in the sauce. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the restaurant, 280 g of cooked spaghetti is nearly half of the plate. The meat sauce adds 376 kcal.',
    tryLine:
      'Type yours the way you would say it, like “spaghetti bolognese, small plate, extra sauce, no cheese”, and Kallo works out the rest.',
  },
};
