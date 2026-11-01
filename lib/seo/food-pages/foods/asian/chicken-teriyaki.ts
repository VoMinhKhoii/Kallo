import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'restaurant',
      label: 'Japanese restaurant, thigh',
      text: 'Chicken teriyaki at a Japanese restaurant (grilled chicken thigh + teriyaki sauce + white rice + steamed vegetables)',
    },
    {
      key: 'bowl',
      label: 'Fast casual bowl',
      text: 'Chicken teriyaki bowl (rice + teriyaki chicken + broccoli + sesame seeds)',
    },
    {
      key: 'salad',
      label: 'Salad instead of rice',
      text: 'Chicken teriyaki (grilled chicken + teriyaki sauce) with salad instead of rice',
    },
    {
      key: 'homemade',
      label: 'Homemade, brown rice',
      text: 'Homemade chicken teriyaki (150g chicken breast + 2 tablespoons teriyaki sauce + 150g cooked brown rice + green beans)',
    },
  ],
  copy: {
    name: 'Chicken teriyaki',
    title: 'How many calories are in chicken teriyaki?',
    metaTitle: 'Calories in Chicken Teriyaki: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of chicken teriyaki, at a Japanese restaurant, as a rice bowl, with salad instead of rice and homemade with brown rice.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Thigh or breast and rice or no rice are the two choices that move it. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the Japanese restaurant, the chicken thigh and the rice are over 80% of it. The glossy teriyaki sauce is only 26 kcal.',
    tryLine:
      'Type yours the way you would say it, like “chicken teriyaki bowl, breast not thigh, half the rice”, and Kallo works out the rest.',
  },
};
