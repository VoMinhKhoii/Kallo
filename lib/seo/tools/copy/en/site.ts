import type { HubCopy, ToolUi } from '../../types';

export const hub: HubCopy = {
  metaTitle: 'Free Calorie, TDEE, Macro, Protein and BMI Calculators',
  description:
    'Free calculators for maintenance calories, a calorie deficit, macros, protein and BMI, using the same maths as the Kallo app. No sign-up.',
  title: 'Calculators',
  lead: 'The numbers behind a diet, worked out with the same formulas Kallo uses when it sets your daily target. Each page shows its maths and its sources.',
  foodLine: 'Calories in everyday meals',
  more: 'Other calculators',
  tryLine:
    'Kallo sets these targets for you at sign-up, then counts what you eat from a sentence like "two eggs, toast with butter, a flat white".',
  sourcesHeading: 'Sources',
};

export const ui: ToolUi = {
  units: 'Units',
  metric: 'Metric',
  imperial: 'Imperial',
  sex: 'Sex',
  male: 'Male',
  female: 'Female',
  age: 'Age',
  years: 'years',
  weight: 'Weight',
  height: 'Height',
  activity: 'Activity',
  activityLevels: {
    sedentary: 'Sedentary: desk job, little exercise',
    light: 'Light: exercise 1–3 days a week',
    moderate: 'Moderate: exercise 3–5 days a week',
    very_active: 'Very active: hard exercise 6–7 days',
  },
  kcalPerDay: 'kcal a day',
  bmr: 'BMR',
  bmrHint: 'burned at complete rest',
  tdee: 'Maintenance (TDEE)',
  tdeeHint: 'eat this to stay the same weight',
  loseHalf: 'To lose 0.5 kg a week',
  gainQuarter: 'To gain 0.25 kg a week',
  goalWeight: 'Goal weight',
  pace: 'Pace',
  perWeek: 'a week',
  dailyTarget: 'Daily target',
  reachBy: 'Goal reached around',
  weeks: 'weeks',
  floored:
    'Held at the minimum Kallo allows ({floor} kcal), so the real pace is about {pace} kg a week.',
  unreachable:
    'At the minimum Kallo allows ({floor} kcal) you would not lose weight: your maintenance is already that low. Moving more raises it.',
  sameWeight: 'Your goal is your current weight: eat at maintenance.',
  calories: 'Calories a day',
  split: 'Split',
  splits: {
    moderate_carb: {
      label: 'Balanced',
      desc: '30% protein, 35% fat, 35% carbs',
    },
    lower_carb: {
      label: 'High protein',
      desc: '40% protein, 40% fat, 20% carbs',
    },
    higher_carb: { label: 'Active', desc: '30% protein, 20% fat, 50% carbs' },
  },
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  gramsPerDay: 'g a day',
  goal: 'Goal',
  proteinGoals: {
    health: 'General health',
    muscle: 'Build muscle',
    cut: 'Lose fat, keep muscle',
  },
  bodyFat: 'Body fat',
  optional: 'optional',
  perKgBody: 'g per kg of body weight',
  perKgLean: 'g per kg of lean mass',
  bmi: 'BMI',
  standardWho: 'WHO',
  standardAsia: 'Asia-Pacific',
  bands: {
    under: 'Underweight',
    normal: 'Normal',
    over: 'Overweight',
    obese: 'Obese',
  },
  normalRange: 'Normal weight for your height',
  fillIn:
    'Enter realistic numbers above (adults, 30–300 kg) to see your result.',
};
