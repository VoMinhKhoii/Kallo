import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'fast-food',
      label: 'Fast food, mayo and pickles',
      text: 'Fried chicken sandwich from a fast food place (brioche bun + crispy fried chicken breast + pickles + mayo)',
    },
    {
      key: 'spicy-fries',
      label: 'Spicy, with fries',
      text: 'Spicy fried chicken sandwich (brioche bun + fried chicken thigh + spicy mayo + coleslaw) with medium fries',
    },
    {
      key: 'grilled',
      label: 'Grilled instead of fried',
      text: 'Grilled chicken sandwich (whole wheat bun + grilled chicken breast + lettuce + tomato + mustard, no mayo)',
    },
    {
      key: 'air-fryer',
      label: 'Homemade, air-fried',
      text: 'Homemade chicken sandwich (1 burger bun + 130g breaded chicken breast cooked in the air fryer + lettuce + 1 tablespoon light mayo)',
    },
  ],
  copy: {
    name: 'Fried chicken sandwich',
    title: 'How many calories are in a fried chicken sandwich?',
    metaTitle: 'Calories in a Fried Chicken Sandwich: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken sandwiches, a fast food fried one, a spicy one with fries, a grilled one and an air-fried homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Fried or grilled, the sauce and the side decide a chicken sandwich. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'fast-food',
    breakdownLead:
      'In the fast food sandwich, the fried chicken is half of it. The bun adds 176 kcal and the mayo 105.',
    tryLine:
      'Type yours the way you would say it, like “crispy chicken sandwich, no mayo, small fries”, and Kallo works out the rest.',
  },
};
