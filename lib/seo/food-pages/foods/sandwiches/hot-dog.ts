import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'ballpark',
      label: 'Ballpark, the usual toppings',
      text: 'Hot dog at a ballpark (beef frank + hot dog bun + mustard + ketchup + relish)',
    },
    {
      key: 'chili-cheese',
      label: 'Chili cheese dog',
      text: 'Chili cheese dog (beef frank + hot dog bun + beef chili + shredded cheese + onions)',
    },
    {
      key: 'two',
      label: 'Two with ketchup and mustard',
      text: '2 hot dogs (2 beef franks + 2 buns + ketchup + mustard)',
    },
    {
      key: 'chicken',
      label: 'Chicken sausage, whole wheat bun',
      text: 'Hot dog with a chicken sausage on a whole wheat bun + mustard + sauerkraut',
    },
  ],
  copy: {
    name: 'Hot dog',
    title: 'How many calories are in a hot dog?',
    metaTitle: 'Calories in a Hot Dog: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real hot dogs, from a ballpark dog to a chili cheese dog and a chicken sausage on whole wheat, broken down part by part.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. One hot dog is a frank and a bun; what goes on top and how many you eat decide the rest. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'ballpark',
    breakdownLead:
      'In the ballpark dog, the frank is about half of it and the bun most of the rest. Ketchup, mustard and relish together add only 43 kcal.',
    tryLine:
      'Type yours the way you would say it, like “two hot dogs, one with chili, ketchup and mustard”, and Kallo works out the rest.',
  },
};
