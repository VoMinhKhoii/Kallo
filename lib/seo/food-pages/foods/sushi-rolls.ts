import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'california',
      label: 'California roll, 8 pieces',
      text: 'California roll, 8 pieces (sushi rice + crab stick + avocado + cucumber + sesame seeds) with soy sauce',
    },
    {
      key: 'spicy-tuna',
      label: 'Spicy tuna roll, 8 pieces',
      text: 'Spicy tuna roll, 8 pieces (sushi rice + tuna + spicy mayo + nori) with soy sauce',
    },
    {
      key: 'tempura',
      label: 'Shrimp tempura roll with sauces',
      text: 'Shrimp tempura roll, 8 pieces, with eel sauce and spicy mayo on top',
    },
    {
      key: 'combo',
      label: 'Lunch combo with nigiri',
      text: 'Sushi lunch combo (6 piece salmon roll + 4 pieces of salmon nigiri + miso soup)',
    },
  ],
  copy: {
    name: 'Sushi rolls',
    title: 'How many calories are in sushi rolls?',
    metaTitle: 'Calories in Sushi Rolls: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real sushi orders, a California roll, a spicy tuna roll, a shrimp tempura roll with sauces and a lunch combo with nigiri.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Sushi rice is most of a roll; tempura and creamy sauces are what push one up. Here are four real orders, each typed into Kallo the way people describe them.`,
    breakdownOf: 'california',
    breakdownLead:
      'In a California roll, the rice is almost 80% of the calories. The crab, avocado and cucumber add about 40 kcal.',
    tryLine:
      'Type yours the way you would say it, like “8 pieces of spicy tuna roll and a miso soup”, and Kallo works out the rest.',
  },
};
