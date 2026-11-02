import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const tdee: ToolCopy = {
  name: 'TDEE calculator',
  blurb: 'Your maintenance calories: what you burn in a normal day.',
  metaTitle: 'TDEE Calculator: Your Maintenance Calories Per Day',
  description:
    'Work out your TDEE, the calories you burn in a day, with the Mifflin-St Jeor formula Kallo uses. Free, no sign-up, with the maths shown.',
  title: 'TDEE calculator',
  lead: 'TDEE, total daily energy expenditure, is how many calories you burn in an ordinary day. Eat about that much and your weight holds; eat less and it drifts down. Fill in the four numbers below and the result updates as you type.',
  sections: [
    {
      heading: 'How the number is worked out',
      paragraphs: [
        'First comes your BMR, the energy your body spends at complete rest: breathing, keeping warm, running your organs. Kallo uses the Mifflin-St Jeor equation, which a 2005 review found the most reliable of the common formulas for both lean and heavier adults: 10 × weight in kg + 6.25 × height in cm − 5 × age, then +5 for men or −161 for women.',
        'Then BMR is multiplied by how much you move: 1.2 if you sit most of the day and rarely exercise, 1.375 for light exercise one to three days a week, 1.55 for three to five days, 1.725 for hard training six or seven days. That product, rounded, is your TDEE. These are the exact numbers the Kallo app uses when it sets your daily target at sign-up.',
      ],
    },
    {
      heading: 'A worked example',
      paragraphs: [
        'A 30-year-old woman, 165 cm and 65 kg, who walks and does a couple of gym sessions a week: BMR = 650 + 1,031 − 150 − 161 = 1,370 kcal. Lightly active, so 1,370 × 1.375 = 1,884 kcal a day. To lose about half a kilo a week she would eat around 1,334.',
        'A 35-year-old man, 178 cm and 82 kg, training four days a week: BMR = 820 + 1,113 − 175 + 5 = 1,763 kcal, and × 1.55 = 2,732 kcal a day.',
      ],
    },
    {
      heading: 'Picking your activity level honestly',
      paragraphs: [
        'Most people overrate this step. An office job plus three gym hours a week is "lightly active", not "moderately". If you are unsure, take the lower level: the formula is an estimate, and erring low costs you a slightly slower result rather than no result.',
      ],
    },
    {
      heading: 'How accurate is it?',
      paragraphs: [
        'For most adults Mifflin-St Jeor lands within about 10% of a lab measurement, which on a 2,000 kcal TDEE is up to 200 kcal either way. Very muscular people tend to burn more than it says, and older or very sedentary people often less. Treat the number as a starting point: log what you eat for two or three weeks, watch your weekly average weight, and adjust by 100 to 200 kcal if it moves when you expected it to hold.',
      ],
    },
    {
      heading: 'What to do with it',
      paragraphs: [
        'Maintenance is the anchor every other target hangs on. Losing weight means eating below it, gaining means eating above it, and the calorie deficit calculator turns a goal weight and a pace into a daily number and a date. The hard part is knowing what you actually eat, which is where most estimates go wrong: a "small" bowl of pasta or a splash of oil changes the total more than the formula ever will.',
      ],
    },
  ],
  sources: [SOURCES.mifflin, SOURCES.frankenfield],
};
