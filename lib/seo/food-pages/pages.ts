import chickenBurrito from './chicken-burrito.json';
import type { FoodSlug } from './slugs';

/**
 * The public food pages: "how many calories in X", answered with real meals
 * logged in Kallo rather than one number.
 *
 * Every number comes from a `<slug>.json` written by
 * `scripts/seo/capture-food-page.ts`, which runs each meal in `meals.ts`
 * through the real pipeline once; the copy below only places them. English
 * only for now: a Vietnamese page is its own dish list, not a translation.
 */

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

export interface FoodPage {
  capture: FoodPageCapture;
  title: string;
  metaTitle: string;
  /** Sentences that quote the page's span, e.g. "300 to 1,000". */
  description: (span: string) => string;
  lead: (span: string) => string;
  /** The meal whose ingredients explain what moves the number. */
  breakdownOf: string;
  breakdownLead: string;
  tryLine: string;
}

const chickenBurritoCapture: FoodPageCapture = chickenBurrito;

export const FOOD_PAGES: Record<FoodSlug, FoodPage> = {
  'chicken-burrito': {
    capture: chickenBurritoCapture,
    title: 'How many calories are in a chicken burrito?',
    metaTitle: 'Calories in a Chicken Burrito: 4 Real Examples',
    description: (span) =>
      `From about ${span} kcal. Four real chicken burritos broken down by tortilla, rice, chicken and toppings, so you can see what moves the number.`,
    lead: (span) =>
      `Anywhere from about ${span} kcal. A burrito is not one food: the tortilla, the rice and the toppings decide the number. Here are four real burritos, each typed into Kallo the way people describe them.`,
    breakdownOf: 'shop',
    breakdownLead:
      'Inside the first burrito, here is where the calories sit. The tortilla and the rice together are nearly half of it.',
    tryLine:
      'Type yours the way you would say it, like “chicken burrito, extra rice, no beans, half the cheese”, and Kallo works out the rest.',
  },
};

/** A meal's total, as its card's rows add up. */
export function mealKcal(variant: FoodPageVariant): number {
  return variant.dishes.reduce((total, dish) => total + dish.calories, 0);
}

/**
 * The span the page's meals cover, rounded out to whole hundreds so a reader
 * can say it aloud: meals of 310 and 975 kcal give "300 to 1,000".
 */
export function kcalSpan(capture: FoodPageCapture): string {
  const totals = capture.variants.map(mealKcal);
  const low = Math.floor(Math.min(...totals) / 100) * 100;
  const high = Math.ceil(Math.max(...totals) / 100) * 100;
  const kcal = (n: number) => n.toLocaleString('en-US');
  return `${kcal(low)} to ${kcal(high)}`;
}

/** The breakdown meal's ingredients, largest first. */
export function breakdownOf(page: FoodPage) {
  const variant = page.capture.variants.find((v) => v.key === page.breakdownOf);
  return [...(variant?.ingredients ?? [])].sort((a, b) => b.kcal - a.kcal);
}

/** The food tables the meals actually used, as one English phrase. */
export function sourcesOf(capture: FoodPageCapture): string {
  const sources = new Set(
    capture.variants.flatMap((v) => v.ingredients.map((i) => i.source))
  );
  return new Intl.ListFormat('en', { type: 'conjunction' }).format([
    ...sources,
  ]);
}
