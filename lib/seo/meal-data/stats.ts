import { type FoodPage, mealKcal, pagesOf } from '@/lib/seo/food-pages/pages';
import type { FoodLocale } from '@/lib/seo/food-pages/slugs';

/**
 * What the food pages' real logged meals show when read together: how far
 * the same dish swings, which ingredients move it, and how often Kallo counts
 * cooking oil nobody typed. Computed from the committed captures at build
 * time, so this page can never disagree with the food pages it summarises.
 *
 * The four meals per dish were written to span how people commonly eat it,
 * not drawn from users' logs; the page says so.
 */

export interface MealSwing {
  page: FoodPage;
  low: number;
  high: number;
  /** Heaviest meal ÷ lightest meal. */
  ratio: number;
  lowLabel: string;
  highLabel: string;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Every dish's lightest and heaviest meal, biggest swing first. */
export function mealSwings(locale: FoodLocale): MealSwing[] {
  return pagesOf(locale)
    .map((page) => {
      const meals = page.capture.variants.map((v) => ({
        kcal: mealKcal(v),
        label: page.meals.find((m) => m.key === v.key)?.label ?? v.key,
      }));
      const lightest = meals.reduce((a, b) => (b.kcal < a.kcal ? b : a));
      const heaviest = meals.reduce((a, b) => (b.kcal > a.kcal ? b : a));
      return {
        page,
        low: lightest.kcal,
        high: heaviest.kcal,
        ratio: heaviest.kcal / Math.max(lightest.kcal, 1),
        lowLabel: lightest.label,
        highLabel: heaviest.label,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * Ingredient kinds by name, per locale. Order matters: first match wins, so
 * noodles come before rice ("rice noodles") and sauces before oil ("dầu hào"
 * is oyster sauce). Plain substrings, not `\b`: JavaScript's word boundary
 * treats accented letters (the ì in "mì") as non-word characters. English captures can carry Vietnamese oil names ("Dầu
 * ăn"), so the English oil pattern accepts them.
 */
const KINDS: Record<FoodLocale, { key: string; pattern: RegExp }[]> = {
  en: [
    {
      key: 'noodles',
      pattern: /pasta|spaghetti|noodle|ramen|linguine|fettuccine|macaroni/,
    },
    {
      key: 'sauce',
      pattern: /sauce|dressing|mayo|aioli|gravy|ketchup|dầu hào/,
    },
    { key: 'oil', pattern: /\boil\b|dầu|mỡ/ },
    { key: 'butter', pattern: /^(?!.*peanut).*\bbutter\b/ },
    { key: 'cheese', pattern: /cheese|parmesan|mozzarella|cheddar|feta/ },
    { key: 'rice', pattern: /\brice\b/ },
    {
      key: 'bread',
      pattern: /tortilla|bread|\bbun\b|bagel|toast|pita|wrap|naan|\broll\b/,
    },
  ],
  vi: [
    { key: 'noodles', pattern: /bún|phở|hủ tiếu|bánh canh|miến|mì/ },
    { key: 'sauce', pattern: /nước mắm|nước chấm|mắm|tương|dầu hào/ },
    { key: 'oil', pattern: /dầu|mỡ/ },
    { key: 'sugar', pattern: /đường|sữa đặc/ },
    { key: 'rice', pattern: /^cơm|gạo/ },
    { key: 'broth', pattern: /nước dùng|nước lèo/ },
  ],
};

/** The kind an ingredient name belongs to, or null. */
export function kindOf(locale: FoodLocale, name: string): string | null {
  const lower = name.toLowerCase();
  return KINDS[locale].find((k) => k.pattern.test(lower))?.key ?? null;
}

/** "The text never mentions oil or frying", per locale. */
const MENTIONS_FAT: Record<FoodLocale, RegExp> = {
  en: /\boil\b|fried|\bfry|fries|butter/,
  vi: /dầu|mỡ|chiên|rán|xào/,
};

export interface IngredientStat {
  key: string;
  /** Meals with at least one line of this kind. */
  meals: number;
  medianKcal: number;
  maxKcal: number;
}

/** Per kind: how many meals carry it and what a line of it costs. */
export function ingredientStats(locale: FoodLocale): IngredientStat[] {
  const lines = new Map<string, number[]>();
  const meals = new Map<string, number>();
  for (const page of pagesOf(locale)) {
    for (const variant of page.capture.variants) {
      const seen = new Set<string>();
      for (const ingredient of variant.ingredients) {
        const kind = kindOf(locale, ingredient.name);
        if (!kind) continue;
        lines.set(kind, [...(lines.get(kind) ?? []), ingredient.kcal]);
        seen.add(kind);
      }
      for (const kind of seen) meals.set(kind, (meals.get(kind) ?? 0) + 1);
    }
  }
  return KINDS[locale]
    .filter((k) => lines.has(k.key))
    .map((k) => {
      const kcal = lines.get(k.key) as number[];
      return {
        key: k.key,
        meals: meals.get(k.key) ?? 0,
        medianKcal: median(kcal),
        maxKcal: Math.max(...kcal),
      };
    })
    .sort((a, b) => b.medianKcal - a.medianKcal);
}

export interface HiddenOil {
  /** All meals read. */
  total: number;
  /** Meals Kallo counted cooking oil or fat in. */
  withOil: number;
  /** Of those, meals whose text never mentions oil, fat or frying. */
  unnamed: number;
  /** Median kcal of that unnamed oil, per meal. */
  medianKcal: number;
}

export function hiddenOil(locale: FoodLocale): HiddenOil {
  let total = 0;
  let withOil = 0;
  const unnamed: number[] = [];
  for (const page of pagesOf(locale)) {
    for (const variant of page.capture.variants) {
      total += 1;
      const kcal = variant.ingredients
        .filter((i) => kindOf(locale, i.name) === 'oil')
        .reduce((sum, i) => sum + i.kcal, 0);
      if (kcal === 0) continue;
      withOil += 1;
      if (!MENTIONS_FAT[locale].test(variant.text.toLowerCase()))
        unnamed.push(kcal);
    }
  }
  return {
    total,
    withOil,
    unnamed: unnamed.length,
    medianKcal: unnamed.length ? median(unnamed) : 0,
  };
}
