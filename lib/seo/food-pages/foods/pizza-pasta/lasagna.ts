import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'pizza-pasta',
  meals: [
    {
      key: 'restaurant',
      label: 'Restaurant, one big piece',
      text: 'Beef lasagna at an Italian restaurant, one large piece (pasta sheets + beef ragu + béchamel + mozzarella + parmesan)',
    },
    {
      key: 'homemade',
      label: 'Homemade, one square',
      text: 'Homemade lasagna, 1 square from a 9x13 tray (beef + ricotta + mozzarella + tomato sauce)',
    },
    {
      key: 'veggie',
      label: 'Vegetable lasagna',
      text: 'Vegetable lasagna, 1 piece (pasta sheets + zucchini + spinach + ricotta + tomato sauce + mozzarella)',
    },
    {
      key: 'frozen',
      label: 'Frozen single serving',
      text: 'Frozen beef lasagna, 1 single-serve tray of about 300g',
    },
  ],
  copy: {
    name: 'Lasagna',
    title: 'How many calories are in lasagna?',
    metaTitle: 'Calories in Lasagna: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real pieces of lasagna, from a restaurant beef lasagna to a homemade square, a vegetable one and a frozen tray.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A piece of lasagna is layers of pasta, sauce and cheese, and the size of the piece decides most of it. Here are four real ones, each typed into Kallo the way people describe them.`,
    breakdownOf: 'restaurant',
    breakdownLead:
      'In the restaurant piece, the meat sauce and the pasta are about even. The mozzarella, parmesan and béchamel together add 226 kcal, more than either.',
    tryLine:
      'Type yours the way you would say it, like “one square of homemade lasagna, beef and ricotta”, and Kallo works out the rest.',
  },
};
