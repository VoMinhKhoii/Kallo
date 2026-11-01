import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'takeout',
      label: 'Takeout with white rice',
      text: 'Chicken stir fry from a Chinese takeout (chicken + broccoli + peppers + brown sauce) with steamed white rice',
    },
    {
      key: 'noodles',
      label: 'With egg noodles',
      text: 'Chicken stir fry with egg noodles (chicken + egg noodles + mixed vegetables + soy sauce + oil)',
    },
    {
      key: 'homemade',
      label: 'Homemade, one cup of rice',
      text: 'Homemade chicken stir fry (150g chicken breast + broccoli + snap peas + carrots + 1 tablespoon oil + soy sauce) with 1 cup of jasmine rice',
    },
    {
      key: 'no-rice',
      label: 'Thigh and bok choy, no rice',
      text: 'Chicken and vegetable stir fry, no rice (chicken thigh + bok choy + mushrooms + garlic + oyster sauce)',
    },
  ],
  copy: {
    name: 'Chicken stir fry',
    title: 'How many calories are in a chicken stir fry?',
    metaTitle: 'Calories in a Chicken Stir Fry: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken stir fries, takeout with rice, with egg noodles, homemade with jasmine rice and a no-rice version.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The vegetables barely count; the rice or noodles under it, the oil and the sauce do. Here are four real stir fries, each typed into Kallo the way people describe them.`,
    breakdownOf: 'takeout',
    breakdownLead:
      'In the takeout box, the chicken and the rice are about a third each. The brown sauce adds 112 kcal.',
    tryLine:
      'Type yours the way you would say it, like “chicken stir fry, light on the sauce, half the rice”, and Kallo works out the rest.',
  },
};
