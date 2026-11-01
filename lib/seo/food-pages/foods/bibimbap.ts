import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'restaurant',
      label: 'Korean restaurant, bulgogi',
      text: 'Bibimbap at a Korean restaurant (rice + bulgogi beef + spinach + bean sprouts + carrots + zucchini + fried egg + gochujang + sesame oil)',
    },
    {
      key: 'dolsot',
      label: 'Hot stone bowl',
      text: 'Dolsot bibimbap in a hot stone bowl (rice + beef + vegetables + raw egg yolk + gochujang)',
    },
    {
      key: 'tofu',
      label: 'Tofu instead of beef',
      text: 'Tofu bibimbap (rice + tofu + vegetables + fried egg + gochujang)',
    },
    {
      key: 'half-rice',
      label: 'Homemade, half a cup of rice',
      text: 'Homemade bibimbap (half a cup of rice + 100g lean beef + lots of vegetables + 1 egg + 1 teaspoon sesame oil + gochujang)',
    },
  ],
  copy: {
    name: 'Bibimbap',
    title: 'How many calories are in bibimbap?',
    metaTitle: 'Calories in Bibimbap: 4 Real Bowls',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of bibimbap, with bulgogi at a Korean restaurant, in a hot stone bowl, with tofu and homemade with half the rice.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The vegetables are most of the bowl by sight and least by calories; the rice, the meat and the oil decide it. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant bowl, the rice and the bulgogi are almost two thirds of it. All the vegetables together are about 40 kcal.',
    tryLine:
      'Type yours the way you would say it, like “bibimbap, half rice, extra vegetables, one egg”, and Kallo works out the rest.',
  },
};
