/**
 * The words around a calculator. Plain strings only: the article renders on
 * the server (readable without JS), and the calculator, a client component,
 * receives its labels as props.
 */
export interface ToolSection {
  heading: string;
  paragraphs: string[];
}

export interface ToolSource {
  label: string;
  href: string;
}

export interface ToolCopy {
  /** The tool as a link names it: "TDEE calculator". */
  name: string;
  /** One line for the hub list. */
  blurb: string;
  metaTitle: string;
  description: string;
  title: string;
  lead: string;
  sections: ToolSection[];
  sources: ToolSource[];
}

export interface HubCopy {
  metaTitle: string;
  description: string;
  title: string;
  lead: string;
  /** The section that links the food pages; absent where there are none. */
  foodLine?: string;
  /** "Other calculators" heading on a tool page. */
  more: string;
  /** "Logged in Kallo, these numbers…" line above the sign-up button. */
  tryLine: string;
  sourcesHeading: string;
}

/** Every label the calculators show, in one locale. */
export interface ToolUi {
  units: string;
  metric: string;
  imperial: string;
  sex: string;
  male: string;
  female: string;
  age: string;
  years: string;
  weight: string;
  height: string;
  activity: string;
  activityLevels: Record<
    'sedentary' | 'light' | 'moderate' | 'very_active',
    string
  >;
  kcalPerDay: string;
  bmr: string;
  bmrHint: string;
  tdee: string;
  tdeeHint: string;
  /** Rows under the TDEE result: "To lose 0.5 kg a week". */
  loseHalf: string;
  gainQuarter: string;
  goalWeight: string;
  pace: string;
  perWeek: string;
  dailyTarget: string;
  reachBy: string;
  weeks: string;
  floored: string;
  sameWeight: string;
  calories: string;
  split: string;
  splits: Record<
    'moderate_carb' | 'lower_carb' | 'higher_carb',
    { label: string; desc: string }
  >;
  protein: string;
  carbs: string;
  fat: string;
  gramsPerDay: string;
  goal: string;
  proteinGoals: Record<'health' | 'muscle' | 'cut', string>;
  bodyFat: string;
  optional: string;
  perKgBody: string;
  perKgLean: string;
  bmi: string;
  standardWho: string;
  standardAsia: string;
  bands: Record<'under' | 'normal' | 'over' | 'obese', string>;
  normalRange: string;
  fillIn: string;
}
