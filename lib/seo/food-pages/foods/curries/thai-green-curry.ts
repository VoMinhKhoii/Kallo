import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'curries',
  meals: [
    {
      key: 'restaurant',
      label: 'Thai restaurant, chicken and rice',
      text: 'Thai green curry with chicken at a Thai restaurant (coconut milk curry + chicken + bamboo shoots + Thai basil) with jasmine rice',
    },
    {
      key: 'tofu',
      label: 'Tofu and vegetables',
      text: 'Thai green curry with tofu and vegetables, with jasmine rice',
    },
    {
      key: 'no-rice',
      label: 'No rice',
      text: 'Chicken green curry, no rice (chicken + eggplant + coconut milk curry)',
    },
    {
      key: 'light',
      label: 'Homemade, light coconut milk',
      text: 'Homemade green curry (150g chicken breast + 100ml light coconut milk + 1 tablespoon green curry paste + green beans) with 150g cooked brown rice',
    },
  ],
  copy: {
    name: 'Thai green curry',
    title: 'How many calories are in Thai green curry?',
    metaTitle: 'Calories in Thai Green Curry: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of Thai green curry, chicken at a Thai restaurant, tofu and vegetables, no rice and homemade with light coconut milk.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Coconut milk is the heart of a green curry and of its calories. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant curry, the coconut milk is the biggest line at 257 kcal, more than the rice or the chicken.',
    tryLine:
      'Type yours the way you would say it, like “green curry with chicken, half the rice, light on the sauce”, and Kallo works out the rest.',
  },
};
