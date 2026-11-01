import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mexican',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, sour cream and guac',
      text: 'Chicken quesadilla at a Mexican restaurant (large flour tortilla + chicken + lots of melted cheese) with sour cream and guacamole on the side',
    },
    {
      key: 'jalapeno',
      label: 'Creamy jalapeño sauce',
      text: 'Chicken quesadilla (flour tortilla + grilled chicken + cheddar and Monterey Jack + creamy jalapeño sauce)',
    },
    {
      key: 'half',
      label: 'Half, with salsa',
      text: 'Half a chicken quesadilla (flour tortilla + chicken + cheese + peppers and onions) with salsa',
    },
    {
      key: 'homemade',
      label: 'Homemade, no oil',
      text: 'Homemade chicken quesadilla (1 whole wheat tortilla + 100g chicken breast + 30g light shredded cheese + peppers), cooked without oil',
    },
  ],
  copy: {
    name: 'Chicken quesadilla',
    title: 'How many calories are in a chicken quesadilla?',
    metaTitle: 'Calories in a Chicken Quesadilla: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken quesadillas, from a restaurant plate with guacamole and sour cream to a homemade one cooked without oil.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A quesadilla is a tortilla and cheese with some chicken in between, and the cheese is the part that varies most. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant quesadilla, the cheese and the tortilla are well over half of it. The guacamole and sour cream on the side add 182 kcal.',
    tryLine:
      'Type yours the way you would say it, like “chicken quesadilla, half the cheese, salsa instead of sour cream”, and Kallo works out the rest.',
  },
};
