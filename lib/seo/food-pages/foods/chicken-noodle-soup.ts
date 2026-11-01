import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'comfort',
  meals: [
    {
      key: 'homemade',
      label: 'Homemade, big bowl',
      text: 'Homemade chicken noodle soup, 1 big bowl (chicken + egg noodles + carrots + celery + broth)',
    },
    {
      key: 'canned',
      label: 'A whole can',
      text: 'Canned chicken noodle soup, the whole can',
    },
    {
      key: 'deli',
      label: 'Deli, with a buttered roll',
      text: 'Chicken noodle soup from a deli with a bread roll and butter',
    },
    {
      key: 'high-protein',
      label: 'Lots of chicken, few noodles',
      text: 'Chicken noodle soup with lots of chicken and few noodles (150g chicken breast + 30g dry egg noodles + vegetables + broth)',
    },
  ],
  copy: {
    name: 'Chicken noodle soup',
    title: 'How many calories are in chicken noodle soup?',
    metaTitle: 'Calories in Chicken Noodle Soup: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of chicken noodle soup, a big homemade bowl, a whole can, a deli soup with a buttered roll and a high-protein bowl.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A canned soup and a homemade bowl are not the same meal; the noodles and the bread beside it decide most of it. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'homemade',
    breakdownLead:
      'In the big homemade bowl, the noodles are the biggest line at 192 kcal. The broth adds 105, more than you might expect.',
    tryLine:
      'Type yours the way you would say it, like “a big bowl of chicken noodle soup, mostly chicken, few noodles”, and Kallo works out the rest.',
  },
};
