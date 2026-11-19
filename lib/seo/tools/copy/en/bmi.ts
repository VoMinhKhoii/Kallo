import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const bmiCopy: ToolCopy = {
  name: 'BMI calculator',
  blurb: 'BMI with both the WHO and the Asian cut-offs.',
  metaTitle: 'BMI Calculator With WHO and Asian Cut-Offs',
  description:
    'Calculate your BMI and see it against both the WHO bands and the Asia-Pacific bands (overweight from 23). Free, no sign-up.',
  title: 'BMI calculator',
  lead: 'Body mass index is your weight divided by your height squared. It is a rough screen, not a diagnosis. The cut-offs depend on the standard: this calculator shows the international WHO and Asia-Pacific bands side by side.',
  sections: [
    {
      heading: 'The formula',
      paragraphs: [
        'BMI = weight in kg ÷ (height in metres)². At 175 cm and 74 kg: 74 ÷ (1.75 × 1.75) = 24.2.',
      ],
    },
    {
      heading: 'Two sets of cut-offs',
      paragraphs: [
        'The WHO international bands: under 18.5 underweight, 18.5 to 24.9 normal, 25 to 29.9 overweight, 30 and over obese.',
        "People of Asian descent tend to carry more body fat, and develop type 2 diabetes and heart disease, at a lower BMI. The Asia-Pacific bands proposed by WHO's Western Pacific office in 2000 put overweight at 23 and obese at 25. Hospitals in Vietnam use them, as do health services in several other Asian countries. A 2004 WHO expert consultation kept the international bands for global comparison but added 23 and 27.5 as action points for Asian populations.",
        'The 175 cm, 74 kg person above is "normal" by WHO and "overweight" by the Asia-Pacific bands. Neither is wrong; they answer different questions.',
      ],
    },
    {
      heading: 'What BMI misses',
      paragraphs: [
        'BMI cannot tell muscle from fat, so strong, muscular people often read as overweight. It says nothing about where fat sits, and fat around the waist carries more risk than fat on the hips. A waist measurement is a useful second check: the same Asia-Pacific report puts the risk line at 90 cm for men and 80 cm for women.',
        'It is also not meant for children, pregnancy, or older adults losing muscle; those need different charts.',
      ],
    },
    {
      heading: 'If you want to change it',
      paragraphs: [
        'BMI only moves when your weight does, and weight moves with calories over weeks. The TDEE calculator gives your maintenance; the calorie deficit calculator gives a daily target and a date. Then the work is knowing what you actually eat.',
      ],
    },
  ],
  sources: [SOURCES.asiaPacific, SOURCES.whoAsia],
};
