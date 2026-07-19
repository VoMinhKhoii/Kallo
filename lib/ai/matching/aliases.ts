import type { MealDecomposition } from '../types';

/**
 * Language tag for an exact-alias entry. Lets a later phase seed English and
 * Vietnamese staples independently and reason about locale coverage, even
 * though the lookup itself is language-agnostic (keys are normalized).
 */
export type AliasLang = 'vi' | 'en';

/**
 * Language-tagged exact alias: a normalized surface form the decomposer emits
 * that should rewrite to a canonical VN-FCT `name_primary` known to exist in
 * the DB. `target` MUST correspond to a real `vietnamese_food_composition`
 * row (verified against the seed at authoring time). This is the seed for the
 * v2 exact/alias-first matcher — NOT the full four-layer concept/portion table
 * (a later phase).
 */
export interface ExactAlias {
  lang: AliasLang;
  target: string;
}

/**
 * Curated exact aliases for staples in the current unmatched log, each mapping
 * to a VERIFIED existing VN-FCT row (checked against supabase/seed.sql):
 *   - Tôm/shrimp     → "Tôm biển"            (fao_vn_2007_8051_raw, sea shrimp)
 *   - Bánh mì        → "Bánh mỳ"             (fao_vn_2007_1012_raw, French bread;
 *                                             seed uses the "mỳ" spelling)
 *   - Bánh bao       → "Bánh bao nhân thịt"  (fao_vn_2007_1009_cooked)
 *   - Mực/squid      → "Mực tươi"            (fao_vn_2007_8040_raw, fresh squid)
 *
 * Deliberately LEFT OUT (no correct DB row exists yet — a later phase adds
 * curated rows): Bánh cuốn, Bánh canh, Hành phi.
 *
 * Keys are normalized (NFC + lowercase + trim) for locale-agnostic lookup.
 */
export const EXACT_ALIASES: Record<string, ExactAlias> = {
  tôm: { lang: 'vi', target: 'Tôm biển' },
  shrimp: { lang: 'en', target: 'Tôm biển' },
  'bánh mì': { lang: 'vi', target: 'Bánh mỳ' },
  'bánh mỳ': { lang: 'vi', target: 'Bánh mỳ' },
  'bánh bao': { lang: 'vi', target: 'Bánh bao nhân thịt' },
  mực: { lang: 'vi', target: 'Mực tươi' },
  squid: { lang: 'en', target: 'Mực tươi' },
};

/**
 * Pre-match aliases: applied BEFORE embedding + DB search to correct known
 * wrong matches. Use when a natural ingredient name gets matched to the
 * wrong food item (e.g., USDA translation errors), not just for unmatched ones.
 *
 * Keys are lowercased for case-insensitive lookup. Merged with the curated
 * `EXACT_ALIASES` staples above (their normalized key → target) so the single
 * `resolvePreMatchAlias` entry point covers both the wrong-match corrections
 * and the exact-alias staples.
 */
export const PRE_MATCH_ALIASES: Record<string, string> = {
  // "Cá lóc" (Southern VN snakehead) → FAO "Cá quả" (Northern VN name for same fish).
  // USDA wrongly translates "bass" as "cá lóc" (Atlantic bass ≠ snakehead).
  'cá lóc': 'Cá quả',
  // "Đậu ve" (short form) → FAO "Đậu cô ve" (French/green beans).
  // USDA matches "đậu ve" to yard-long bean seeds — wrong variety.
  'đậu ve': 'Đậu cô ve',
  ...Object.fromEntries(
    Object.entries(EXACT_ALIASES).map(([key, { target }]) => [key, target])
  ),
};

/**
 * Resolve a pre-match alias. Returns the canonical search name if a
 * pre-match alias exists, otherwise the original name unchanged.
 */
export function resolvePreMatchAlias(name: string): string {
  const key = name.normalize('NFC').toLowerCase().trim();
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
  'fish sauce': 'Nước mắm',
  'vegetable oil': 'Dầu đậu nành',
  'cooking oil': 'Dầu đậu nành',
  sugar: 'Đường kính',
  squid: 'Mực ống',
  'steamed white rice': 'Cơm',
  rice: 'Cơm',
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
      if (ingredient.canonicalName) {
        ingredient.canonicalName = resolveAlias(ingredient.canonicalName);
      } else if (ingredient.name) {
        ingredient.name = resolveAlias(ingredient.name);
      }
    }
  }
}
