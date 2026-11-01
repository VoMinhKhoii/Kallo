import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'asian',
  meals: [
    {
      key: 'shop',
      label: 'Poke shop, salmon and spicy mayo',
      text: 'Salmon poke bowl from a poke shop (sushi rice + raw salmon + avocado + edamame + cucumber + spicy mayo + sesame seeds)',
    },
    {
      key: 'half-rice',
      label: 'Half rice, half salad, no mayo',
      text: 'Tuna poke bowl (half sushi rice, half salad + ahi tuna + cucumber + edamame + seaweed salad + ponzu, no mayo)',
    },
    {
      key: 'greens',
      label: 'On greens, no rice',
      text: 'Poke bowl on mixed greens, no rice (tuna + salmon + mango + cucumber + edamame + a drizzle of spicy mayo)',
    },
    {
      key: 'homemade',
      label: 'Homemade, brown rice',
      text: 'Homemade salmon poke bowl (1 cup cooked brown rice + 100g raw salmon + half an avocado + cucumber + 1 tablespoon soy sauce)',
    },
  ],
  copy: {
    name: 'Poke bowl',
    title: 'How many calories are in a poke bowl?',
    metaTitle: 'Calories in a Poke Bowl: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real poke bowls, from a shop bowl with salmon and spicy mayo to half rice, greens only and homemade with brown rice.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The fish is the steady part; the rice and the sauce are what move a poke bowl. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'shop',
    breakdownLead:
      'In the shop bowl, the salmon and the rice are about 200 kcal each. One spoon of spicy mayo adds 102.',
    tryLine:
      'Type yours the way you would say it, like “poke bowl, half rice half greens, sauce on the side”, and Kallo works out the rest.',
  },
};
