import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'comfort',
  meals: [
    {
      key: 'meal',
      label: 'Two pieces with sides',
      text: 'Fried chicken meal (1 fried chicken breast + 1 fried thigh) with mashed potatoes and gravy and coleslaw',
    },
    {
      key: 'three-piece',
      label: 'Three pieces, skin on',
      text: '3 pieces of fried chicken (drumstick + thigh + wing), skin on',
    },
    {
      key: 'tenders',
      label: 'Four tenders, honey mustard',
      text: '4 fried chicken tenders with honey mustard sauce',
    },
    {
      key: 'no-skin',
      label: 'Two pieces, skin taken off',
      text: '2 pieces of fried chicken (1 breast + 1 drumstick), I took the skin off',
    },
  ],
  copy: {
    name: 'Fried chicken',
    title: 'How many calories are in fried chicken?',
    metaTitle: 'Calories in Fried Chicken: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real servings of fried chicken, a two-piece meal with sides, three pieces with skin, chicken tenders and two pieces with the skin taken off.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Which pieces, whether the skin stays on and what comes with it decide a fried chicken meal. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'meal',
    breakdownLead:
      'In the two-piece meal, the chicken is about 60% of it. The mashed potatoes, gravy and coleslaw add 516 kcal.',
    tryLine:
      'Type yours the way you would say it, like “two pieces of fried chicken, a breast and a wing, no sides”, and Kallo works out the rest.',
  },
};
