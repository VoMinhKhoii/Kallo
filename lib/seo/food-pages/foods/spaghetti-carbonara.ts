import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'restaurant',
      label: 'Italian restaurant, guanciale',
      text: 'Spaghetti carbonara at an Italian restaurant (spaghetti + guanciale + egg yolks + pecorino + black pepper)',
    },
    {
      key: 'cream',
      label: 'With cream and bacon',
      text: 'Spaghetti carbonara made with cream (spaghetti + bacon + cream + egg + parmesan)',
    },
    {
      key: 'homemade',
      label: 'Homemade, weighed',
      text: 'Homemade carbonara (100g dry spaghetti + 2 eggs + 40g pancetta + 20g parmesan)',
    },
    {
      key: 'small',
      label: 'Small plate',
      text: 'Small plate of carbonara (1 cup cooked spaghetti + a bit of bacon + egg + parmesan)',
    },
  ],
  copy: {
    name: 'Spaghetti carbonara',
    title: 'How many calories are in spaghetti carbonara?',
    metaTitle: 'Calories in Spaghetti Carbonara: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real plates of carbonara, the restaurant kind with guanciale, a creamy one with bacon, a weighed homemade plate and a small one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The pasta portion sets the floor; cream and how much cured pork goes in decide the rest. Here are four real plates, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'At the restaurant, the pasta is just over half of it. The egg yolks, guanciale and pecorino that make the sauce add 288 kcal.',
    tryLine:
      'Type yours the way you would say it, like “carbonara, small plate, no cream, extra pepper”, and Kallo works out the rest.',
  },
};
