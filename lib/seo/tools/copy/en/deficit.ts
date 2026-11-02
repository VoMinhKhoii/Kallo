import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const deficit: ToolCopy = {
  name: 'Calorie deficit calculator',
  blurb: 'A daily target and a date for your goal weight.',
  metaTitle: 'Calorie Deficit Calculator: Daily Target and Goal Date',
  description:
    'How many calories to eat to lose weight, and when you would reach your goal. Uses the same maths and safety floors as the Kallo app.',
  title: 'Calorie deficit calculator',
  lead: 'Tell it your body, your goal weight and how fast you want to get there. It works out your maintenance calories, takes the deficit off, and tells you the daily target and roughly when you would arrive. Gaining works the same way in reverse.',
  sections: [
    {
      heading: 'Where the daily target comes from',
      paragraphs: [
        'A kilogram of body fat holds roughly 7,700 kcal. Spread over a week, losing 0.5 kg means eating about 550 kcal a day below your maintenance; 0.25 kg means about 275. The calculator first finds your maintenance with the Mifflin-St Jeor formula (see the TDEE calculator), then subtracts the deficit for the pace you pick.',
        'Kallo never sets a target below 1,200 kcal for women or 1,500 kcal for men, the common minimum dietitians use for unsupervised dieting. If your pace would push you under it, the calculator holds you at the floor and shows the slower pace you would really get.',
      ],
    },
    {
      heading: 'A worked example',
      paragraphs: [
        'A 30-year-old woman, 165 cm, 65 kg, lightly active, has a maintenance of about 1,884 kcal. Aiming for 60 kg at 0.5 kg a week: 1,884 − 550 = 1,334 kcal a day, and 5 kg ÷ 0.5 = 10 weeks.',
        'Now a smaller, less active woman: 25 years old, 158 cm, 55 kg, desk job. Her maintenance is about 1,502 kcal, so the same 0.5 kg a week would mean 952 kcal. The floor holds her at 1,200, which works out to about 0.27 kg a week. Slower, but it is a pace she can actually eat to.',
      ],
    },
    {
      heading: 'Why the date is a best case',
      paragraphs: [
        "The 7,700 rule is a straight line, and bodies are not. As you get lighter your maintenance drops, so the same intake makes a smaller deficit, and early weeks include water that comes off fast. Kevin Hall's 2011 model in The Lancet showed the simple rule overestimates loss over months. Re-run the calculator every few kilos with your new weight, and judge progress on a two-to-three week average, not day to day.",
      ],
    },
    {
      heading: 'Choosing a pace',
      paragraphs: [
        'Around 0.25 to 0.5 kg a week is the range most people can sustain while keeping their muscle and their social life. Faster is possible for people with more to lose, but hunger and lost muscle make it harder to keep the weight off. Eating enough protein (see the protein calculator) matters more in a deficit, not less.',
      ],
    },
    {
      heading: 'Hitting the number',
      paragraphs: [
        'A target only works if your logging is honest. Most of the gap between "I eat 1,400" and the scale not moving is hidden: cooking oil, sauces, a second serving of rice, the drink with lunch. Logging what you really ate, in your own words, is what Kallo is built for.',
      ],
    },
  ],
  sources: [SOURCES.mifflin, SOURCES.hall],
};
