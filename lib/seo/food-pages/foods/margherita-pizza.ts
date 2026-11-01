import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'neapolitan',
      label: 'A whole Neapolitan pizza',
      text: 'Neapolitan margherita pizza, the whole 12 inch pizza (thin crust + tomato sauce + fresh mozzarella + basil + olive oil)',
    },
    {
      key: 'shared',
      label: 'Half, shared at a restaurant',
      text: 'Half a margherita pizza from an Italian restaurant, I shared it',
    },
    {
      key: 'slices',
      label: 'Two regular slices',
      text: '2 slices of margherita pizza (regular crust + tomato sauce + mozzarella)',
    },
    {
      key: 'tortilla',
      label: 'Homemade on a tortilla',
      text: 'Homemade margherita pizza on a tortilla base (1 large flour tortilla + 3 tablespoons tomato sauce + 60g light mozzarella + basil)',
    },
  ],
  copy: {
    name: 'Margherita pizza',
    title: 'How many calories are in a margherita pizza?',
    metaTitle: 'Calories in a Margherita Pizza: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real margherita pizzas, a whole Neapolitan one, half a shared pizza, two slices and a homemade tortilla pizza.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. With only tomato, mozzarella and basil on top, a margherita is mostly dough, and how much of it you eat decides the number. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'neapolitan',
    breakdownLead:
      'A whole Neapolitan pizza is mostly crust: 576 kcal of dough, then 371 of fresh mozzarella. The sauce and basil barely register.',
    tryLine:
      'Type yours the way you would say it, like “half a margherita pizza, shared, thin crust”, and Kallo works out the rest.',
  },
};
