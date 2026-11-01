import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'lamb',
      label: 'Lamb, fries inside',
      text: 'Lamb gyro from a Greek place (pita + gyro meat + tzatziki + tomato + onion + fries inside)',
    },
    {
      key: 'chicken',
      label: 'Chicken, no fries',
      text: 'Chicken gyro (pita + chicken gyro meat + tzatziki + tomato + onion), no fries',
    },
    {
      key: 'plate',
      label: 'Plate with rice and salad',
      text: 'Gyro plate (gyro meat + rice + salad with tomato, cucumber and feta + tzatziki + 1 pita)',
    },
    {
      key: 'bowl',
      label: 'Bowl, no pita',
      text: 'Chicken gyro bowl, no pita (chicken + rice + cucumber + tomato + a bit of feta + tzatziki)',
    },
  ],
  copy: {
    name: 'Gyro',
    title: 'How many calories are in a gyro?',
    metaTitle: 'Calories in a Gyro: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real gyros, lamb with fries inside, chicken without fries, a gyro plate with rice and a bowl without pita.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The meat, the pita and whether fries go inside decide a gyro. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'lamb',
    breakdownLead:
      'In the lamb gyro, the meat is nearly half of it. The fries tucked inside add 98 kcal, while the tzatziki is only 29.',
    tryLine:
      'Type yours the way you would say it, like “chicken gyro, extra tzatziki, no fries”, and Kallo works out the rest.',
  },
};
