import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'breakfast',
  meals: [
    {
      key: 'shop',
      label: 'Smoothie shop, granola and honey',
      text: 'Acai bowl from a smoothie shop (acai blended with banana + granola + strawberries + banana slices + honey + coconut flakes)',
    },
    {
      key: 'peanut-butter',
      label: 'With peanut butter',
      text: 'Acai bowl (acai blended with banana + 1 tablespoon peanut butter + granola + sliced strawberries)',
    },
    {
      key: 'small',
      label: 'Small, no honey',
      text: 'Small acai bowl (acai base + blueberries + a sprinkle of granola, no honey)',
    },
    {
      key: 'homemade',
      label: 'Homemade, one acai pack',
      text: 'Homemade acai bowl (100g frozen acai pack + half a frozen banana + 50ml almond milk + 20g granola + a few raspberries)',
    },
  ],
  copy: {
    name: 'Acai bowl',
    title: 'How many calories are in an acai bowl?',
    metaTitle: 'Calories in an Acai Bowl: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real acai bowls, from a smoothie shop bowl with honey and coconut to a small one, showing where the calories really are.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The acai is the light part; the toppings are where an acai bowl gets its calories. Here are four real bowls, each typed into Kallo the way people describe them.`,
    breakdownOf: 'shop',
    breakdownLead:
      'In the smoothie shop bowl, the granola is nearly half of it. The acai itself is only 62 kcal.',
    tryLine:
      'Type yours the way you would say it, like “acai bowl, half the granola, no honey”, and Kallo works out the rest.',
  },
};
