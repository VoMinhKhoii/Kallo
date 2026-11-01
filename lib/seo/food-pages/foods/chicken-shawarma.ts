import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'wrap-fries',
      label: 'Shawarma shop wrap, fries inside',
      text: 'Chicken shawarma wrap from a shawarma shop (large pita + chicken shawarma + garlic sauce + pickles + fries inside the wrap)',
    },
    {
      key: 'plate',
      label: 'Plate with rice and hummus',
      text: 'Chicken shawarma plate (chicken shawarma + rice + hummus + salad + garlic sauce)',
    },
    {
      key: 'wrap-light',
      label: 'Wrap, no fries, no garlic sauce',
      text: 'Chicken shawarma wrap (thin pita + chicken shawarma + lettuce + tomato + a bit of tahini, no fries, no garlic sauce)',
    },
    {
      key: 'salad-bowl',
      label: 'Salad bowl, no rice or pita',
      text: 'Chicken shawarma salad bowl (chicken shawarma + salad + a spoon of hummus + a bit of tahini, no rice, no pita)',
    },
  ],
  copy: {
    name: 'Chicken shawarma',
    title: 'How many calories are in a chicken shawarma?',
    metaTitle: 'Calories in Chicken Shawarma: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken shawarmas, a shop wrap with fries inside, a plate with rice and hummus, a light wrap and a salad bowl.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The chicken changes little from one shawarma to the next; the bread, the fries and the sauces are what move it. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'wrap-fries',
    breakdownLead:
      'In the shop wrap, the pita and the fries inside it each carry more calories than the chicken does.',
    tryLine:
      'Type yours the way you would say it, like “chicken shawarma wrap, no fries, a little garlic sauce”, and Kallo works out the rest.',
  },
};
