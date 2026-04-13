import type { MealDecomposition } from '../types';

/**
 * Pre-match aliases: applied BEFORE embedding + DB search to correct known
 * wrong matches. Use when a natural ingredient name gets matched to the
 * wrong food item (e.g., USDA translation errors), not just for unmatched ones.
 *
 * Keys are lowercased for case-insensitive lookup.
 */
export const PRE_MATCH_ALIASES: Record<string, string> = {
  // "Cá lóc" (Southern VN snakehead) → FAO "Cá quả" (Northern VN name for same fish).
  // USDA wrongly translates "bass" as "cá lóc" (Atlantic bass ≠ snakehead).
  'cá lóc': 'Cá quả',
  // "Đậu ve" (short form) → FAO "Đậu cô ve" (French/green beans).
  // USDA matches "đậu ve" to yard-long bean seeds — wrong variety.
  'đậu ve': 'Đậu cô ve',
};

/**
 * Resolve a pre-match alias. Returns the canonical search name if a
 * pre-match alias exists, otherwise the original name unchanged.
 */
export function resolvePreMatchAlias(name: string): string {
  const key = name.toLowerCase().trim();
  return PRE_MATCH_ALIASES[key] ?? name;
}

/**
 * Common ingredient aliases: map shorthand Vietnamese names to canonical
 * DB names. Applied as fallback for unmatched ingredients only.
 * See PRE_MATCH_ALIASES for aliases that fire before matching.
 *
 * Keys are lowercased for case-insensitive lookup.
 * Expand over time based on `unmatched_ingredients` log analysis.
 */
export const INGREDIENT_ALIASES: Record<string, string> = {
  cơm: 'Gạo tẻ',
  'ba chỉ': 'Thịt lợn ba chỉ',
  'ba rọi': 'Thịt lợn ba chỉ',
  trứng: 'Trứng gà',
  đậu: 'Đậu phụ',
  tôm: 'Tôm sú',
  'thịt bò': 'Thịt bò loại 1',
  'thịt heo': 'Thịt lợn nạc',
  'thịt gà': 'Thịt gà ta',
  cá: 'Cá quả',
  'rau muống': 'Rau muống',
  bún: 'Bún',
  phở: 'Bánh phở',
  mì: 'Mì sợi',
  'dầu ăn': 'Dầu đậu nành',
  'nước mắm': 'Nước mắm',
  đường: 'Đường kính',
  muối: 'Muối',
  hành: 'Hành lá',
  tỏi: 'Tỏi',
  ớt: 'Ớt',
  tiêu: 'Hạt tiêu',
  gạo: 'Gạo tẻ',
  sữa: 'Sữa bò tươi',
};

/**
 * Resolve a single ingredient name through the alias map.
 * Returns the canonical name if an alias exists, otherwise the original name.
 */
export function resolveAlias(name: string): string {
  const key = name.toLowerCase().trim();
  return INGREDIENT_ALIASES[key] ?? name;
}

/**
 * Apply alias resolution to all ingredients in a decomposition result.
 * Mutates the decomposition in place for efficiency.
 */
export function applyIngredientAliases(decomposition: MealDecomposition): void {
  for (const mealItem of decomposition.mealItems) {
    for (const ingredient of mealItem.ingredients) {
      ingredient.name = resolveAlias(ingredient.name);
    }
  }
}
