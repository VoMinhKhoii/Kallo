/**
 * The shapes behind a food page: what is written by hand (`foods/<group>/<slug>.ts`)
 * and what the capture script writes (`captures/<slug>.json`).
 */
import type { FoodLocale } from './slugs';

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

/**
 * Each locale's hub sections, in the order it lists them. A group belongs to
 * one locale, so its key alone says which hub it is on.
 */
export const FOOD_GROUPS = {
  en: {
    breakfast: 'Breakfast',
    sandwiches: 'Burgers, sandwiches and wraps',
    mexican: 'Mexican',
    'pizza-pasta': 'Pizza and pasta',
    asian: 'Asian',
    curries: 'Curries and chili',
    salads: 'Salads',
    comfort: 'Chicken and comfort food',
  },
  vi: {
    'mon-nuoc': 'Món nước',
    'bun-cuon': 'Bún, bánh cuốn và món cuốn',
    'com-tam-banh-mi': 'Cơm tấm, bánh mì và xôi',
    'do-uong': 'Đồ uống',
    'nau-o-nha': 'Nấu ở nhà',
  },
} as const satisfies Record<FoodLocale, Record<string, string>>;

// Distributes over a union of locales: `keyof` of a union would keep only
// the keys every locale shares, which is none.
export type FoodGroupOf<L extends FoodLocale> = L extends FoodLocale
  ? keyof (typeof FOOD_GROUPS)[L]
  : never;

export type FoodGroup = FoodGroupOf<FoodLocale>;

/** The words around the numbers. Sentences that quote the span take it in. */
export interface FoodPageCopy {
  /** The food as a link names it: "Chicken burrito". */
  name: string;
  title: string;
  metaTitle: string;
  /** `span` reads like "300 to 1,000" (or "300 đến 1.000"). */
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
