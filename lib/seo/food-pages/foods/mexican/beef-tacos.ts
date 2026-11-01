import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mexican',
  meals: [
    {
      key: 'truck',
      label: 'Taco truck, three corn tacos',
      text: '3 beef tacos from a taco truck (corn tortillas + seasoned ground beef + onion + cilantro + salsa)',
    },
    {
      key: 'hard-shell',
      label: 'Two hard shells with cheese',
      text: '2 hard shell beef tacos (crunchy shells + ground beef + shredded cheese + lettuce + sour cream)',
    },
    {
      key: 'carne-asada',
      label: 'Carne asada on flour tortillas',
      text: '3 carne asada tacos on flour tortillas with guacamole and cheese',
    },
    {
      key: 'homemade',
      label: 'Homemade, lean beef',
      text: 'Homemade beef tacos (2 small corn tortillas + 100g lean ground beef + lettuce + tomato + salsa + a bit of cheese)',
    },
  ],
  copy: {
    name: 'Beef tacos',
    title: 'How many calories are in beef tacos?',
    metaTitle: 'Calories in Beef Tacos: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real orders of beef tacos, from a taco truck to hard shells with cheese and a lean homemade plate, broken down by filling.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A taco is small, so the count and the filling decide the meal. Here are four real taco plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'truck',
    breakdownLead:
      'In the taco truck order, the seasoned beef is about 60% of the calories. The three corn tortillas add 171.',
    tryLine:
      'Type yours the way you would say it, like “three beef tacos, corn tortillas, no cheese”, and Kallo works out the rest.',
  },
};
