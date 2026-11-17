import { FOOD_PAGES, type FoodPage } from '@/lib/seo/food-pages/pages';
import type { FoodLocale, FoodSlugOf } from '@/lib/seo/food-pages/slugs';
import type { ToolSlug } from './slugs';

/**
 * Each calculator's "calories in real meals" section: three food pages that
 * show what a day's number is made of, in the calculator's own locale. They
 * are examples of meals and their portions, not meals sized to the result: a
 * daily target is not a per-meal allowance.
 */
export const TOOL_EXAMPLE_MEALS: {
  [L in FoodLocale]: Record<ToolSlug, FoodSlugOf<L>[]>;
} = {
  en: {
    'tdee-calculator': ['chicken-burrito', 'poke-bowl', 'chicken-caesar-salad'],
    'calorie-deficit-calculator': [
      'greek-salad',
      'cobb-salad',
      'chicken-quesadilla',
    ],
    'macro-calculator': ['bibimbap', 'chicken-stir-fry', 'beef-tacos'],
    'protein-calculator': [
      'chicken-and-rice',
      'greek-yogurt-parfait',
      'chicken-teriyaki',
    ],
    'bmi-calculator': ['oatmeal', 'fish-and-chips', 'chili-con-carne'],
  },
  vi: {
    'tdee-calculator': ['pho-bo', 'com-tam-suon', 'banh-mi-thit'],
    'calorie-deficit-calculator': [
      'tra-sua-tran-chau',
      'ca-phe-sua-da',
      'banh-bao',
    ],
    'macro-calculator': ['bun-cha', 'canh-chua', 'dau-phu-sot-ca-chua'],
    'protein-calculator': ['ga-rang-gung', 'thit-kho-trung', 'ca-kho-to'],
    'bmi-calculator': ['xoi', 'banh-xeo', 'bun-thit-nuong'],
  },
};

/** A calculator's example meals as food pages, in its own locale. */
export function exampleMealPages(
  locale: FoodLocale,
  tool: ToolSlug
): FoodPage[] {
  return TOOL_EXAMPLE_MEALS[locale][tool].map((slug) => FOOD_PAGES[slug]);
}
