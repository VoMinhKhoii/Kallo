import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'shop',
      label: 'Pho shop, large bowl',
      text: 'Beef pho from a pho shop, large bowl (rice noodles + rare beef + brisket + broth + bean sprouts + basil + hoisin and sriracha)',
    },
    {
      key: 'chicken',
      label: 'Chicken, small bowl, half the broth',
      text: 'Chicken pho, small bowl (rice noodles + chicken breast + broth + herbs), drank half the broth',
    },
    {
      key: 'meatballs',
      label: 'Extra noodles and meatballs',
      text: 'Beef pho with extra noodles (rice noodles + beef meatballs + brisket + broth)',
    },
    {
      key: 'homemade',
      label: 'Homemade, lean sirloin',
      text: 'Homemade beef pho (100g fresh rice noodles + 80g lean sirloin + clear broth + herbs, no hoisin)',
    },
  ],
  copy: {
    name: 'Pho',
    title: 'How many calories are in pho?',
    metaTitle: 'Calories in Pho: 4 Real Bowls',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of pho, a large beef bowl from a pho shop, a small chicken one, extra noodles with meatballs and a homemade bowl.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The broth is lighter than it looks; the noodles and the cuts of beef decide a bowl. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'shop',
    breakdownLead:
      'In the large bowl from the pho shop, the noodles and the beef are 85% of the calories. The broth is only 39 kcal, so drinking all of it changes little.',
    tryLine:
      'Type yours the way you would say it, like “beef pho, small bowl, brisket, left half the noodles”, and Kallo works out the rest.',
  },
};
