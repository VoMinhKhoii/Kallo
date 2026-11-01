import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'tonkotsu',
      label: 'Tonkotsu, drank most of the broth',
      text: 'Tonkotsu ramen at a ramen shop (pork bone broth + ramen noodles + 2 slices of chashu pork + half a soft-boiled egg + green onion + nori), drank most of the broth',
    },
    {
      key: 'shoyu',
      label: 'Shoyu chicken, left the broth',
      text: 'Shoyu chicken ramen (ramen noodles + soy sauce broth + chicken + soft-boiled egg + bamboo shoots + spinach), left most of the broth',
    },
    {
      key: 'instant',
      label: 'Instant, with an egg',
      text: 'Instant ramen (1 pack with the full seasoning packet) + 1 egg cracked in',
    },
    {
      key: 'miso-extra',
      label: 'Spicy miso, extra noodles and butter',
      text: 'Spicy miso ramen with extra noodles (ramen noodles + miso soup + chashu pork + corn + a pat of butter + soft-boiled egg)',
    },
  ],
  copy: {
    name: 'Ramen',
    title: 'How many calories are in ramen?',
    metaTitle: 'Calories in Ramen: 4 Real Bowls',
    description: (span) =>
      `From about ${span} kcal. Four real bowls of ramen, tonkotsu with most of the broth, shoyu chicken, instant ramen with an egg and spicy miso with extra noodles.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The noodles are one half of a bowl; a rich broth can be the other, so how much you drink matters. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'tonkotsu',
    breakdownLead:
      'In the tonkotsu bowl, the pork bone broth is 374 kcal, almost as much as the noodles. Leaving most of it is the biggest single cut you can make.',
    tryLine:
      'Type yours the way you would say it, like “tonkotsu ramen, left most of the broth, extra egg”, and Kallo works out the rest.',
  },
};
