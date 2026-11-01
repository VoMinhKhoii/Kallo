import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'curries',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, pilau rice and naan',
      text: 'Butter chicken from an Indian restaurant (butter chicken + pilau rice + butter naan)',
    },
    {
      key: 'rice',
      label: 'With basmati rice',
      text: 'Butter chicken with plain basmati rice',
    },
    {
      key: 'half',
      label: 'Half a takeaway portion',
      text: 'Half a portion of takeaway butter chicken with a little rice',
    },
    {
      key: 'homemade',
      label: 'Homemade, chicken thigh',
      text: 'Homemade butter chicken (150g chicken thigh + tomato sauce + 1 tablespoon butter + 50ml cream) with 150g cooked rice',
    },
  ],
  copy: {
    name: 'Butter chicken',
    title: 'How many calories are in butter chicken?',
    metaTitle: 'Calories in Butter Chicken: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of butter chicken, from a restaurant with pilau rice and naan to half a takeaway and a homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The butter and cream in the sauce matter, but so do the rice and bread around it. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the restaurant, the naan and the pilau rice are more than half of it. The butter and oil across the plate add another 228 kcal.',
    tryLine:
      'Type yours the way you would say it, like “butter chicken, half portion, plain rice, no naan”, and Kallo works out the rest.',
  },
};
