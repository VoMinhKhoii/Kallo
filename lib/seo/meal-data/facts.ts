import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { captureDateRange } from '@/lib/seo/food-pages/pages';
import type { FoodLocale } from '@/lib/seo/food-pages/slugs';
import type { MealDataFacts } from './copy';
import {
  hiddenOil,
  type IngredientStat,
  ingredientStats,
  type MealSwing,
  mealSwings,
  median,
} from './stats';

export interface MealData {
  facts: MealDataFacts;
  swings: MealSwing[];
  kinds: IngredientStat[];
}

/** A ratio to one decimal, as the locale writes it: 2.2× / 2,2 lần. */
export function formatRatio(locale: FoodLocale, ratio: number): string {
  return (Math.round(ratio * 10) / 10).toLocaleString(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  );
}

const cache = new Map<FoodLocale, MealData>();

/**
 * Everything the data page shows for one locale, computed once from the
 * committed captures (metadata and content share it).
 */
export function mealData(locale: FoodLocale): MealData {
  const hit = cache.get(locale);
  if (hit) return hit;
  const swings = mealSwings(locale);
  const oil = hiddenOil(locale);
  const { formatDate } = FOOD_PAGE_CHROME[locale];
  const { first, last } = captureDateRange(locale);
  const data: MealData = {
    swings,
    kinds: ingredientStats(locale),
    facts: {
      meals: oil.total,
      dishes: swings.length,
      perDish: Math.round(oil.total / swings.length),
      ratio: formatRatio(locale, median(swings.map((s) => s.ratio * 10)) / 10),
      withOil: oil.withOil,
      unnamed: oil.unnamed,
      oilKcal: oil.medianKcal,
      dates: {
        from: formatDate(new Date(first)),
        to: formatDate(new Date(last)),
      },
    },
  };
  cache.set(locale, data);
  return data;
}
