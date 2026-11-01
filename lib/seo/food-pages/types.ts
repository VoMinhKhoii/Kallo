/**
 * The shapes behind a food page: what is written by hand (`foods/<slug>.ts`)
 * and what the capture script writes (`captures/<slug>.json`).
 */

/**
 * One meal on a food page: the heading the reader sees and the sentence typed
 * into Kallo. `scripts/seo/capture-food-page.ts` captures exactly this text,
 * and a test fails when a page's capture no longer matches it.
 *
 * Write it the way people log: parts, amounts and what was left out ("no
 * rice, a bit of cheese"). A bare "1 chicken burrito" shows nothing Kallo does
 * that a lookup table does not.
 */
export interface FoodPageMeal {
  key: string;
  label: string;
  text: string;
}

/** The hub's sections, in the order it lists them. */
export const FOOD_GROUPS = {
  breakfast: 'Breakfast',
  sandwiches: 'Burgers, sandwiches and wraps',
  mexican: 'Mexican',
  'pizza-pasta': 'Pizza and pasta',
  asian: 'Asian',
  curries: 'Curries and chili',
  salads: 'Salads',
  comfort: 'Chicken and comfort food',
} as const;

export type FoodGroup = keyof typeof FOOD_GROUPS;

/** The words around the numbers. Sentences that quote the span take it in. */
export interface FoodPageCopy {
  /** The food as a link names it: "Chicken burrito". */
  name: string;
  title: string;
  metaTitle: string;
  /** `span` reads like "300 to 1,000". */
  description: (span: string) => string;
  lead: (span: string) => string;
  /** The meal whose ingredients explain what moves the number. */
  breakdownOf: string;
  breakdownLead: string;
  tryLine: string;
}

/** Everything written by hand for one food page. */
export interface FoodContent {
  group: FoodGroup;
  meals: FoodPageMeal[];
  copy: FoodPageCopy;
}

/** One captured meal, as the capture script writes it. */
export interface FoodPageVariant {
  key: string;
  /** The sentence typed into Kallo. */
  text: string;
  ingredients: { name: string; grams: number; kcal: number; source: string }[];
  /** The rows the app's meal card shows. */
  dishes: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
}

export interface FoodPageCapture {
  capturedAt: string;
  /** Which model profile produced the numbers, kept as provenance. */
  modelProfile: string;
  variants: FoodPageVariant[];
}
