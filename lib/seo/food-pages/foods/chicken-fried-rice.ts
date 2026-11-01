import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'takeout',
      label: 'Takeout, the whole container',
      text: 'Chicken fried rice from a Chinese takeout, the whole container (fried rice + chicken + egg + peas + carrots + soy sauce)',
    },
    {
      key: 'half',
      label: 'Takeout, ate about half',
      text: 'Chicken fried rice from a Chinese takeout, I ate about half the container',
    },
    {
      key: 'homemade',
      label: 'Homemade, one cup of rice',
      text: 'Homemade chicken fried rice (1 cup cooked jasmine rice + 100g chicken breast + 1 egg + frozen peas and carrots + 1 tablespoon oil + soy sauce)',
    },
    {
      key: 'cauliflower',
      label: 'Cauliflower rice',
      text: 'Chicken fried cauliflower rice (200g cauliflower rice + 120g chicken breast + 1 egg + peas + 1 teaspoon sesame oil)',
    },
  ],
  copy: {
    name: 'Chicken fried rice',
    title: 'How many calories are in chicken fried rice?',
    metaTitle: 'Calories in Chicken Fried Rice: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real servings of chicken fried rice, a full takeout container, half of one, a homemade plate and a cauliflower rice version.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. Fried rice is mostly rice and oil, so the portion and the pan decide it. Here are four real servings, each typed into Kallo the way people describe them.`,
    breakdownOf: 'takeout',
    breakdownLead:
      'In the full takeout container, the rice is more than half of it. The chicken is only 68 kcal.',
    tryLine:
      'Type yours the way you would say it, like “chicken fried rice, about half the box”, and Kallo works out the rest.',
  },
};
