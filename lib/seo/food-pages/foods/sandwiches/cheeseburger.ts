import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'sandwiches',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, bacon and fries',
      text: 'Cheeseburger at a restaurant (brioche bun + 6oz beef patty + 2 slices of cheddar + bacon + lettuce + tomato + mayo) with a side of fries',
    },
    {
      key: 'fast-food',
      label: 'Fast food double',
      text: 'Fast food double cheeseburger (bun + 2 thin beef patties + 2 slices of American cheese + pickles + ketchup + mustard)',
    },
    {
      key: 'lettuce-wrap',
      label: 'No bun, lettuce wrap',
      text: 'Cheeseburger with no bun, in a lettuce wrap (quarter-pound beef patty + 1 slice of cheddar + tomato + onion + mustard)',
    },
    {
      key: 'homemade',
      label: 'Homemade, lean beef',
      text: 'Homemade cheeseburger (whole wheat bun + 120g lean beef patty + 1 slice of light cheese + lettuce + tomato + ketchup)',
    },
  ],
  copy: {
    name: 'Cheeseburger',
    title: 'How many calories are in a cheeseburger?',
    metaTitle: 'Calories in a Cheeseburger: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real cheeseburgers, from a restaurant burger with bacon and fries to a lean homemade one, broken down part by part.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The patty size, the cheese and the side are what move a cheeseburger, more than the bun. Here are four real burgers, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the restaurant, the fries add as much as the two slices of cheddar, 226 kcal each. Without the side, the burger alone is about 1,030 kcal.',
    tryLine:
      'Type yours the way you would say it, like “cheeseburger, single patty, no mayo, side salad instead of fries”, and Kallo works out the rest.',
  },
};
