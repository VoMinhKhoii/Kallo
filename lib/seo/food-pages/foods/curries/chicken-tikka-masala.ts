import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'curries',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, rice and garlic naan',
      text: 'Chicken tikka masala at an Indian restaurant (chicken tikka masala + basmati rice + 1 garlic naan)',
    },
    {
      key: 'rice',
      label: 'With rice, no naan',
      text: 'Chicken tikka masala with basmati rice, no naan',
    },
    {
      key: 'naan',
      label: 'With naan, no rice',
      text: 'Chicken tikka masala with 1 plain naan, no rice',
    },
    {
      key: 'homemade',
      label: 'Homemade, light cream',
      text: 'Homemade chicken tikka masala (150g chicken breast + tomato sauce + 2 tablespoons light cream + spices) with 1 cup of cooked basmati rice',
    },
  ],
  copy: {
    name: 'Chicken tikka masala',
    title: 'How many calories are in chicken tikka masala?',
    metaTitle: 'Calories in Chicken Tikka Masala: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of chicken tikka masala, at an Indian restaurant with rice and naan, with rice only, with naan only and homemade.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The curry is only part of it; rice, naan or both on the side is the bigger choice. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the Indian restaurant, the garlic naan is the biggest line at 262 kcal, more than the chicken. With the rice, the sides are more than half of the meal.',
    tryLine:
      'Type yours the way you would say it, like “chicken tikka masala, half rice, no naan”, and Kallo works out the rest.',
  },
};
