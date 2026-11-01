import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mexican',
  meals: [
    {
      key: 'loaded',
      label: 'Loaded bar nachos, ate half',
      text: 'Loaded nachos at a bar, shared between 2 (tortilla chips + ground beef + melted cheese + sour cream + guacamole + jalapeños), I ate half',
    },
    {
      key: 'cheese-sauce',
      label: 'Chips and cheese sauce',
      text: 'Nachos with cheese sauce (tortilla chips + nacho cheese sauce + jalapeños)',
    },
    {
      key: 'chicken',
      label: 'Chicken and black beans',
      text: 'Chicken nachos (tortilla chips + shredded chicken + black beans + cheese + salsa + sour cream)',
    },
    {
      key: 'homemade',
      label: 'Homemade, no sour cream',
      text: 'Homemade nachos (40g tortilla chips + 30g shredded cheese + black beans + salsa), no sour cream',
    },
  ],
  copy: {
    name: 'Nachos',
    title: 'How many calories are in nachos?',
    metaTitle: 'Calories in Nachos: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of nachos, from half a loaded bar platter to chips with cheese sauce and a homemade plate, broken down by topping.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Nachos are mostly chips, and how many you actually eat is the hard part to guess. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'loaded',
    breakdownLead:
      'In your half of the bar nachos, the chips alone are 298 kcal, more than the cheese and the beef together.',
    tryLine:
      'Type yours the way you would say it, like “nachos, shared with a friend, I had about a third”, and Kallo works out the rest.',
  },
};
