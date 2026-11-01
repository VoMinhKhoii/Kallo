import type { FoodContent } from '../types';

export const food: FoodContent = {
  group: 'mexican',
  meals: [
    {
      key: 'shop',
      label: 'Burrito shop, everything in it',
      text: 'Chicken burrito from a burrito shop (large flour tortilla + grilled chicken + white rice + black beans + cheese + sour cream + guacamole)',
    },
    {
      key: 'shop-lighter',
      label: 'Burrito shop, no cheese or sour cream',
      text: 'Chicken burrito from a burrito shop (large flour tortilla + grilled chicken + white rice + black beans + salsa, no cheese, no sour cream)',
    },
    {
      key: 'bowl-no-rice',
      label: 'Burrito bowl, no rice',
      text: 'Chicken burrito bowl (1 tortilla + 1 scoop of grilled chicken + salad and pineapple + a bit of cheese, no rice)',
    },
    {
      key: 'homemade',
      label: 'Homemade, small tortilla',
      text: 'Homemade chicken burrito (1 small flour tortilla + 100g grilled chicken breast + lettuce + salsa + a bit of cheese)',
    },
  ],
  copy: {
    name: 'Chicken burrito',
    title: 'How many calories are in a chicken burrito?',
    metaTitle: 'Calories in a Chicken Burrito: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken burritos broken down by tortilla, rice, chicken and toppings, so you can see what moves the number.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A burrito is not one food: the tortilla, the rice and the toppings decide the number. Here are four real burritos, each typed into Kallo the way people describe them.`,
    breakdownOf: 'shop',
    breakdownLead:
      'Inside the first burrito, here is where the calories sit. The tortilla and the rice together are nearly half of it.',
    tryLine:
      'Type yours the way you would say it, like “chicken burrito, extra rice, no beans, half the cheese”, and Kallo works out the rest.',
  },
};
