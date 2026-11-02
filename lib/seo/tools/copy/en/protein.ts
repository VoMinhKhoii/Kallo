import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const protein: ToolCopy = {
  name: 'Protein calculator',
  blurb: 'How many grams of protein a day, from your weight and goal.',
  metaTitle: 'Protein Calculator: How Much Protein Per Day?',
  description:
    'How much protein you need a day for health, building muscle or losing fat, from the research ranges (ISSN, Morton 2018). Free, no sign-up.',
  title: 'Protein calculator',
  lead: 'How much protein you need depends mostly on two things: how much you weigh and what you are training for. Pick your goal and the calculator gives the range the research supports, in grams a day.',
  sections: [
    {
      heading: 'The ranges, and where they come from',
      paragraphs: [
        'For general health, the official minimum (the RDA) is 0.8 g per kg of body weight a day. It is the amount that prevents deficiency in most adults, not an amount meant for building or keeping muscle.',
        'If you lift or train, the International Society of Sports Nutrition recommends 1.4 to 2.0 g per kg. A 2018 meta-analysis of 49 trials (Morton et al.) found that muscle gains stopped improving past about 1.6 g per kg on average, with some people benefiting up to around 2.2.',
        'In a calorie deficit, protein helps you keep the muscle you have. For lean, resistance-trained people dieting, the ISSN suggests 2.3 to 3.1 g per kg of lean mass. Add your body fat percentage and the calculator uses that range; without it, it stays on the per-body-weight range.',
      ],
    },
    {
      heading: 'A worked example',
      paragraphs: [
        'At 70 kg: 56 g a day for general health, 98 to 140 g if you train (about 113 g at 1.6 g/kg). At 70 kg and 25% body fat, cutting, your lean mass is 52.5 kg, so 121 to 163 g.',
      ],
    },
    {
      heading: 'What that looks like as food',
      paragraphs: [
        '113 g of protein is roughly: two eggs at breakfast (12 g), a chicken breast at lunch (about 45 g for 150 g cooked), a pot of Greek yogurt (17 g), and a portion of fish, tofu or lean meat at dinner (around 30 g), with the rest from rice, bread, beans and milk. Spreading it over three or four meals works better than one large serving.',
      ],
    },
    {
      heading: 'Is too much protein a problem?',
      paragraphs: [
        'For healthy adults, intakes within these ranges have not been shown to harm the kidneys or bones. If you have kidney disease, talk to your doctor before raising protein. The practical limit is usually cost and appetite, not safety.',
      ],
    },
  ],
  sources: [SOURCES.dri, SOURCES.issn, SOURCES.morton],
};
