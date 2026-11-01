import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'takeout',
      label: 'Takeout with fried rice',
      text: 'Orange chicken from a Chinese takeout (battered chicken + orange sauce) with fried rice',
    },
    {
      key: 'white-rice',
      label: 'With steamed rice',
      text: 'Orange chicken with steamed white rice',
    },
    {
      key: 'small',
      label: 'Small portion, no rice',
      text: 'Small portion of orange chicken, no rice',
    },
    {
      key: 'air-fried',
      label: 'Homemade, air-fried',
      text: 'Homemade orange chicken (150g chicken breast tossed in cornstarch and air-fried + 2 tablespoons orange sauce) with 1 cup of jasmine rice',
    },
  ],
  copy: {
    name: 'Orange chicken',
    title: 'How many calories are in orange chicken?',
    metaTitle: 'Calories in Orange Chicken: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real servings of orange chicken, takeout with fried rice, with steamed rice, a small portion and an air-fried homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The batter, the frying and the sweet sauce are what make orange chicken heavier than the chicken in it. Here are four real servings, each typed into Kallo the way people describe them.`,
    breakdownOf: 'takeout',
    breakdownLead:
      'In the takeout box, the battered chicken is the biggest line at 315 kcal. The orange sauce adds 147 and the frying oil another 97.',
    tryLine:
      'Type yours the way you would say it, like “orange chicken, small portion, steamed rice instead of fried”, and Kallo works out the rest.',
  },
};
