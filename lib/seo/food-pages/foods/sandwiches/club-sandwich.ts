import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'cafe',
      label: 'Café, with chips',
      text: 'Club sandwich from a café (3 slices of toasted white bread + turkey + bacon + lettuce + tomato + mayo) with a side of potato chips',
    },
    {
      key: 'chicken',
      label: 'Chicken and cheese',
      text: 'Club sandwich (3 slices of white toast + chicken breast + bacon + cheese + lettuce + tomato + mayo)',
    },
    {
      key: 'no-mayo',
      label: 'Two slices, no mayo',
      text: 'Turkey club on 2 slices of whole wheat bread (turkey + 1 strip of bacon + lettuce + tomato + mustard, no mayo)',
    },
    {
      key: 'half',
      label: 'Half a sandwich',
      text: 'Half a club sandwich (toasted white bread + turkey + ham + bacon + cheese + mayo)',
    },
  ],
  copy: {
    name: 'Club sandwich',
    title: 'How many calories are in a club sandwich?',
    metaTitle: 'Calories in a Club Sandwich: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real club sandwiches, from a cafe club with chips to a two-slice turkey club without mayo, broken down layer by layer.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A club is three slices of bread with mayo between them, and that is where most of it sits. Here are four real club sandwiches, each typed into Kallo the way people describe them.`,
    breakdownOf: 'cafe',
    breakdownLead:
      'In the cafe club, the bread is the biggest line at 191 kcal. The side of chips adds 147 more, about a quarter of the plate.',
    tryLine:
      'Type yours the way you would say it, like “turkey club, two slices of bread, no mayo”, and Kallo works out the rest.',
  },
};
