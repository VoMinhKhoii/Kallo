import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'comfort',
  meals: [
    {
      key: 'meal-prep',
      label: 'Meal prep with broccoli',
      text: 'Meal prep chicken and rice (150g chicken breast + 150g cooked white rice + 100g broccoli)',
    },
    {
      key: 'halal-cart',
      label: 'Halal cart, white sauce',
      text: 'Chicken over rice from a halal cart (yellow rice + chicken + lettuce + white sauce + hot sauce)',
    },
    {
      key: 'thighs',
      label: 'Pan-fried thighs',
      text: 'Chicken and rice (2 boneless chicken thighs pan-fried in oil + 1 cup of jasmine rice)',
    },
    {
      key: 'bulk',
      label: 'Big bowl with avocado',
      text: 'Big chicken and rice bowl (200g chicken breast + 2 cups cooked rice + 1 tablespoon olive oil + half an avocado)',
    },
  ],
  copy: {
    name: 'Chicken and rice',
    title: 'How many calories are in chicken and rice?',
    metaTitle: 'Calories in Chicken and Rice: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of chicken and rice, a meal prep box, halal cart chicken over rice, pan-fried thighs and a big bulking bowl.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The simplest meal there is still swings: thigh or breast, how much rice and how much oil. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'meal-prep',
    breakdownLead:
      'In the meal prep box, the rice and the chicken are nearly equal at 190 and 171 kcal. The broccoli is 42.',
    tryLine:
      'Type yours the way you would say it, like “150g chicken breast, a cup of rice, cooked in a teaspoon of oil”, and Kallo works out the rest.',
  },
};
