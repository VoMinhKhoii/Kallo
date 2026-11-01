import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'two-slices',
      label: 'Two slices from a pizza place',
      text: '2 slices of a large pepperoni pizza from a pizza place (regular crust + tomato sauce + mozzarella + pepperoni)',
    },
    {
      key: 'deep-dish',
      label: 'One deep-dish slice',
      text: '1 slice of deep-dish pepperoni pizza',
    },
    {
      key: 'thin-half',
      label: 'Half a thin crust pizza',
      text: 'Half of a 12 inch thin crust pepperoni pizza',
    },
    {
      key: 'frozen',
      label: 'Half a frozen pizza',
      text: 'Half a frozen pepperoni pizza, about 200g',
    },
  ],
  copy: {
    name: 'Pepperoni pizza',
    title: 'How many calories are in pepperoni pizza?',
    metaTitle: 'Calories in Pepperoni Pizza: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real servings of pepperoni pizza, two slices from a pizza place, a deep-dish slice, half a thin crust and half a frozen pizza.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The crust is where most of a pizza is, so its thickness and the number of slices matter more than the topping. Here are four real servings, each typed into Kallo the way people describe them.`,
    breakdownOf: 'two-slices',
    breakdownLead:
      'In two slices from a pizza place, the crust is more than half the calories. The pepperoni is 111 kcal.',
    tryLine:
      'Type yours the way you would say it, like “two slices of pepperoni pizza, thin crust, large pizza”, and Kallo works out the rest.',
  },
};
