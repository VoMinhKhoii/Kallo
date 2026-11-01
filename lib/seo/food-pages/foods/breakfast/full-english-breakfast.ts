import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'cafe',
      label: 'Café, the full plate',
      text: 'Full English breakfast at a café (2 fried eggs + 2 pork sausages + 2 rashers of bacon + baked beans + hash browns + grilled tomato + mushrooms + 1 slice of toast with butter)',
    },
    {
      key: 'no-toast',
      label: 'No toast, no hash browns',
      text: 'Full English breakfast (2 pork sausages + 2 rashers of bacon + 1 fried egg + baked beans + grilled tomato + mushrooms), no toast, no hash browns',
    },
    {
      key: 'grilled',
      label: 'Homemade, grilled and poached',
      text: 'Homemade full English (2 poached eggs + 2 grilled turkey sausages + 1 rasher of back bacon + half a can of baked beans + mushrooms)',
    },
    {
      key: 'veggie',
      label: 'Veggie, halloumi',
      text: 'Veggie full English breakfast (2 fried eggs + 2 vegetarian sausages + 2 slices of grilled halloumi + baked beans + mushrooms + 1 slice of toast)',
    },
  ],
  copy: {
    name: 'Full English breakfast',
    title: 'How many calories are in a full English breakfast?',
    metaTitle: 'Calories in a Full English Breakfast: 4 Real Plates',
    description: (span) =>
      `From about ${span} kcal. Four real full English breakfasts, from a cafe fry-up to a grilled homemade plate, broken down item by item.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A full English is a dozen small things, and a few of them carry most of the plate. Here are four real breakfasts, each typed into Kallo the way people describe them.`,
    breakdownOf: 'cafe',
    breakdownLead:
      'On the cafe plate, the two sausages are the biggest line at 326 kcal. The hash browns come second, ahead of the bacon.',
    tryLine:
      'Type yours the way you would say it, like “full English, no toast, grilled not fried”, and Kallo works out the rest.',
  },
};
