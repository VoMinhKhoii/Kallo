import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'comfort',
  meals: [
    {
      key: 'buffalo',
      label: 'Ten buffalo, blue cheese dip',
      text: '10 buffalo chicken wings with blue cheese dip and celery',
    },
    { key: 'bbq', label: 'Six BBQ wings', text: '6 BBQ chicken wings' },
    {
      key: 'boneless',
      label: 'Ten boneless, honey garlic',
      text: '10 boneless chicken wings with honey garlic sauce',
    },
    {
      key: 'air-fried',
      label: 'Eight air-fried, dry rub',
      text: '8 air-fried chicken wings with a dry rub, no sauce',
    },
  ],
  copy: {
    name: 'Chicken wings',
    title: 'How many calories are in chicken wings?',
    metaTitle: 'Calories in Chicken Wings: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real orders of chicken wings, ten buffalo wings with blue cheese dip, six BBQ wings, ten boneless wings and eight air-fried ones.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. The count is the obvious part; frying, breading and the dip are what make wings add up. Here are four real orders, each typed into Kallo the way people describe them.`,
    breakdownOf: 'boneless',
    breakdownLead:
      'Boneless wings are breaded chicken. In the order of ten, the honey garlic sauce adds 186 kcal, about a quarter of it.',
    tryLine:
      'Type yours the way you would say it, like “8 buffalo wings, a little ranch, no celery”, and Kallo works out the rest.',
  },
};
