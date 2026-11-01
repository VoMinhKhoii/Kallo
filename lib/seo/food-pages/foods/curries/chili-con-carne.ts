import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'curries',
  meals: [
    {
      key: 'toppings',
      label: 'Cheese and sour cream on top',
      text: 'Bowl of chili con carne (ground beef + kidney beans + tomato) with shredded cheese and sour cream on top',
    },
    {
      key: 'rice',
      label: 'With white rice',
      text: 'Chili con carne with white rice',
    },
    {
      key: 'canned',
      label: 'A whole can',
      text: '1 can of chili con carne with beans, the whole can',
    },
    {
      key: 'turkey',
      label: 'Homemade turkey chili',
      text: 'Homemade turkey chili (150g lean turkey mince + kidney beans + tomato + peppers), no toppings',
    },
  ],
  copy: {
    name: 'Chili con carne',
    title: 'How many calories are in chili con carne?',
    metaTitle: 'Calories in Chili con Carne: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of chili con carne, with cheese and sour cream, with rice, a whole can and a homemade turkey chili.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The meat sets the base; the toppings and the rice under it decide the rest. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'toppings',
    breakdownLead:
      'In the topped bowl, the beef is about 40% of it. The cheese and sour cream on top add 182 kcal.',
    tryLine:
      'Type yours the way you would say it, like “chili con carne, lean beef, a spoon of sour cream, no cheese”, and Kallo works out the rest.',
  },
};
