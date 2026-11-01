import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'salads',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, ranch',
      text: 'Cobb salad at a restaurant (romaine + grilled chicken + bacon + hard-boiled egg + avocado + blue cheese + tomato) with ranch dressing',
    },
    {
      key: 'vinaigrette',
      label: 'Vinaigrette instead of ranch',
      text: 'Cobb salad with red wine vinaigrette instead of ranch (romaine + chicken + bacon + egg + avocado + tomato + blue cheese)',
    },
    {
      key: 'no-bacon',
      label: 'No bacon, no blue cheese',
      text: 'Cobb salad, no bacon, no blue cheese (romaine + chicken + egg + avocado + tomato + light vinaigrette)',
    },
    {
      key: 'homemade',
      label: 'Homemade, weighed',
      text: 'Homemade cobb salad (2 cups romaine + 100g chicken breast + 1 boiled egg + a quarter of an avocado + 1 strip of bacon + 1 tablespoon blue cheese dressing)',
    },
  ],
  copy: {
    name: 'Cobb salad',
    title: 'How many calories are in a Cobb salad?',
    metaTitle: 'Calories in a Cobb Salad: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real Cobb salads, a restaurant one with ranch, one with vinaigrette, one without bacon or blue cheese and a weighed homemade one.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A Cobb is many rich toppings in small amounts, so leaving one or two out moves it a lot. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'No single item runs a Cobb. The chicken is 151 kcal and the ranch 129, and the bacon, avocado, blue cheese and egg each add between 67 and 91.',
    tryLine:
      'Type yours the way you would say it, like “Cobb salad, no bacon, half the blue cheese, vinaigrette”, and Kallo works out the rest.',
  },
};
