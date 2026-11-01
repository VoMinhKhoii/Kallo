import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'restaurant',
      label: 'Thai restaurant, chicken',
      text: 'Chicken pad thai from a Thai restaurant (rice noodles + chicken + egg + bean sprouts + crushed peanuts + tamarind sauce)',
    },
    {
      key: 'half-box',
      label: 'Takeout, ate about half',
      text: 'Shrimp pad thai from a takeout box (rice noodles + shrimp + egg + bean sprouts + peanuts), I ate about half the box',
    },
    {
      key: 'tofu',
      label: 'Fried tofu, extra peanuts',
      text: 'Tofu pad thai (rice noodles + fried tofu + egg + bean sprouts + spring onion + extra crushed peanuts)',
    },
    {
      key: 'homemade',
      label: 'Homemade, weighed noodles',
      text: 'Homemade chicken pad thai (75g dry rice noodles + 100g chicken breast + 1 egg + bean sprouts + 1 tablespoon oil + 1 tablespoon peanuts)',
    },
  ],
  copy: {
    name: 'Pad thai',
    title: 'How many calories are in pad thai?',
    metaTitle: 'Calories in Pad Thai: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of pad thai, chicken from a Thai restaurant, half a shrimp takeout box, tofu with extra peanuts and a homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The noodles are only part of it; the oil, the sweet sauce and the peanuts add up fast. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant pad thai, the noodles are under a third. The sauce, the oil and the peanuts together add 216 kcal, more than the noodles.',
    tryLine:
      'Type yours the way you would say it, like “pad thai with shrimp, ate about half, no extra peanuts”, and Kallo works out the rest.',
  },
};
