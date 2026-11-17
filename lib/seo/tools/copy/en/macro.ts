import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const macro: ToolCopy = {
  name: 'Macro calculator',
  blurb: 'Protein, carbs and fat in grams for your calorie target.',
  metaTitle: 'Macro Calculator: Protein, Carbs and Fat in Grams',
  description:
    'Turn a calorie target into grams of protein, carbs and fat with the three Kallo splits. Free, instant results with the maths shown.',
  title: 'Macro calculator',
  lead: 'Calories say how much to eat; macros say what it is made of. Enter your daily target, or let the calculator work it out from your measurements, and pick a split. You get grams of protein, carbohydrate and fat you can actually aim for.',
  sections: [
    {
      heading: 'How grams come from calories',
      paragraphs: [
        'Protein and carbohydrate carry about 4 kcal per gram, fat about 9. A split is the share of your calories each one gets. On 1,800 kcal with 30% protein: 1,800 × 0.30 = 540 kcal, ÷ 4 = 135 g of protein.',
      ],
    },
    {
      heading: 'The three splits',
      paragraphs: [
        'Balanced (30% protein, 35% fat, 35% carbs) suits most people and most cuisines. On 1,800 kcal it gives 135 g protein, 70 g fat and 158 g carbs.',
        'High protein (40 / 40 / 20) keeps carbs low and protein high; it helps people who feel fuller on protein and fat, and on a cut it protects muscle. On 1,800 kcal: 180 g protein, 80 g fat, 90 g carbs.',
        'Active (30 / 20 / 50) gives the most carbohydrate, for people who train hard or eat rice- and noodle-based meals most days. On 1,800 kcal: 135 g protein, 40 g fat, 225 g carbs.',
        'These are the same three choices the Kallo app offers at sign-up.',
      ],
    },
    {
      heading: 'Which one should I pick?',
      paragraphs: [
        'Pick the one you can keep eating. For weight change, total calories matter far more than the split; the split mostly decides how full you feel and how you train. Get enough protein (the protein calculator gives a range from your weight and goal), then let carbs and fat fall where your food culture puts them.',
      ],
    },
    {
      heading: 'Hitting macros without weighing everything',
      paragraphs: [
        'Most people can hit protein within 10 to 20 grams by knowing a few anchors: 100 g of cooked chicken breast has about 31 g, an egg about 6 g, a 170 g pot of Greek yogurt about 17 g. Carbs and fat are harder to see because they hide in rice portions, oil and sauces. Logging meals as you really ate them, in plain words, is the quickest way to see where your grams go.',
      ],
    },
  ],
  sources: [SOURCES.dri, SOURCES.issn],
};
