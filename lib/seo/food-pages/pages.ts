import chickenBurrito from './chicken-burrito.json';
import type { FoodSlug } from './slugs';

/**
 * The public food pages: "how many calories in X", answered with real meals
 * logged in Kallo rather than one number.
 *
 * Every number comes from a `<slug>.json` written by
 * `scripts/seo/capture-food-page.ts`, which runs each meal through the real
 * pipeline once. Nothing numeric is typed here. English only for now; a
 * Vietnamese page is its own dish list, not a translation.
 */

/** One captured meal, as the capture script writes it. */
export interface FoodPageVariant {
  key: string;
  /** The sentence typed into Kallo. */
  text: string;
  kcal: { low: number; mid: number; high: number };
  protein: number;
  carbs: number;
  fat: number;
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
  modelProfile: string;
  variants: FoodPageVariant[];
}

export interface FoodPage {
  capture: FoodPageCapture;
  title: string;
  metaTitle: string;
  description: string;
  lead: string;
  /** A heading for each captured variant, by its key. */
  labels: Record<string, string>;
  /** The variant whose ingredients explain what moves the number. */
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
    description:
      'From about 300 to 1,000 kcal. Four real chicken burritos broken down by tortilla, rice, chicken and toppings, so you can see what moves the number.',
    lead: 'Anywhere from about 300 to 1,000 kcal. A burrito is not one food: the tortilla, the rice and the toppings decide the number. Here are four real burritos, each typed into Kallo the way people describe them.',
    labels: {
      shop: 'Burrito shop, everything in it',
      'shop-lighter': 'Burrito shop, no cheese or sour cream',
      'bowl-no-rice': 'Burrito bowl, no rice',
      homemade: 'Homemade, small tortilla',
    },
    breakdownOf: 'shop',
    breakdownLead:
      'Inside the first burrito, here is where the calories sit. The tortilla and the rice together are nearly half of it.',
    tryLine:
      'Type yours the way you would say it, like “chicken burrito, extra rice, no beans, half the cheese”, and Kallo works out the rest.',
  },
};
