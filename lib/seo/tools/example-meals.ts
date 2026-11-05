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

export const TOOL_EXAMPLE_COPY: Record<
  FoodLocale,
  { heading: string; lead: string }
> = {
  en: {
    heading: 'Calories in real meals',
    lead: 'A daily number is easier to use once you know what everyday meals come to. Each of these was logged in Kallo several ways, from a light portion to a full one.',
  },
  vi: {
    heading: 'Calo trong các bữa ăn thật',
    lead: 'Con số mỗi ngày dễ dùng hơn khi bạn biết các món quen thuộc nặng bao nhiêu calo. Mỗi món dưới đây được ghi vào Kallo vài cách, từ phần nhỏ đến phần đầy đủ.',
  },
};
