import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'brunch',
      label: 'Brunch place, with home fries',
      text: 'Eggs Benedict at a brunch place (English muffin + 2 poached eggs + 2 slices of Canadian bacon + hollandaise sauce) with a side of home fries',
    },
    {
      key: 'classic',
      label: 'Classic, no sides',
      text: 'Eggs Benedict (1 English muffin + 2 poached eggs + 2 slices of ham + hollandaise sauce)',
    },
    {
      key: 'salmon',
      label: 'Smoked salmon instead of ham',
      text: 'Eggs Benedict with smoked salmon (1 English muffin + 2 poached eggs + 50g smoked salmon + hollandaise sauce)',
    },
    {
      key: 'half',
      label: 'Half portion, a little sauce',
      text: 'Half an eggs Benedict (half an English muffin + 1 poached egg + 1 slice of ham + a little hollandaise)',
    },
  ],
  copy: {
    name: 'Eggs Benedict',
    title: 'How many calories are in eggs Benedict?',
    metaTitle: 'Calories in Eggs Benedict: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of eggs Benedict, with ham, with smoked salmon and as a half portion, broken down ingredient by ingredient.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The eggs are the steady part; the hollandaise, the muffin and whatever comes on the side are what change. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'brunch',
    breakdownLead:
      'At the brunch place, the side of home fries is the biggest single line, more than the hollandaise and the Canadian bacon put together.',
    tryLine:
      'Type yours the way you would say it, like “eggs Benedict, one egg, sauce on the side”, and Kallo works out the rest.',
  },
};
