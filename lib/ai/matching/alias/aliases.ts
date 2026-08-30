import type { MealDecomposition } from '@/lib/ai/types/decomposition';

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
 *   - Bánh ướt       → "Bánh ướt"            (usda_20134_cooked, curated steamed
 *                                             rice sheets — added this migration)
 *   - Bánh cuốn      → "Bánh ướt"            (usda_20134_cooked, same rice-sheet
 *                                             batter as bánh ướt)
 *   - Hủ tiếu        → "Bánh phở"            (fao_vn_2007_1013_raw, fresh rice
 *                                             noodle proxy)
 *   - Bánh hỏi       → "Bún"                 (fao_vn_2007_1020_raw, woven rice
 *                                             vermicelli proxy — proxy caveat)
 *   - Xôi            → "Xôi trắng"           (usda_20055_cooked, unseasoned
 *                                             cooked glutinous rice)
 *
 * Deliberately LEFT OUT (no correct DB row exists yet — a later phase adds
 * curated rows): Bánh canh (tapioca-based, no honest proxy), Hành phi.
 *
 * Keys are normalized (NFC + lowercase + trim) for locale-agnostic lookup.
 */
/**
 * `name_primary` of usda_6583_raw after migration 20260806120000. Named once
 * so the alias targets and the portion concept's `dbRowName` cannot drift
 * apart from the migration — a target that does not name a real row rewrites
 * the user's words into a query the lexical arm matches even less well.
 */
export const INSTANT_NOODLE_ROW = 'Mì ăn liền (mì gói), khô';

export const EXACT_ALIASES: Record<string, ExactAlias> = {
  tôm: { lang: 'vi', target: 'Tôm biển' },
  shrimp: { lang: 'en', target: 'Tôm biển' },
  'bánh mì': { lang: 'vi', target: 'Bánh mỳ' },
  'bánh mỳ': { lang: 'vi', target: 'Bánh mỳ' },
  'bánh bao': { lang: 'vi', target: 'Bánh bao nhân thịt' },
  mực: { lang: 'vi', target: 'Mực tươi' },
  squid: { lang: 'en', target: 'Mực tươi' },
  'bánh ướt': { lang: 'vi', target: 'Bánh ướt' },
  'bánh cuốn': { lang: 'vi', target: 'Bánh ướt' },
  'hủ tiếu': { lang: 'vi', target: 'Bánh phở' },
  'bánh hỏi': { lang: 'vi', target: 'Bún' },
  xôi: { lang: 'vi', target: 'Xôi trắng' },
  // Instant noodles. The DB rows (usda_6583/6982/6983/27035_raw) existed all
  // along but kept their untranslated English `name_primary`, so a Vietnamese
  // query scored under the acceptance floors — "mì gói" peaked at 0.572 on
  // "Mì gạo khô" (dry RICE noodles) and "mì ăn liền" matched instant RICE at
  // 0.728. Migration 20260806120000 curates the names; these keys cover the
  // surface forms that are NOT safe to put in `name_alt`:
  //   - `mì tôm`: word_similarity('tôm', 'mì tôm') = 1.0, so as a fuzzy target
  //     it would make every shrimp query match instant noodles perfectly.
  //   - `mì ly` / `mì cốc`: same hazard via the bare unit word 'ly'.
  // An exact normalized-key rewrite has no such blast radius.
  'mì tôm': { lang: 'vi', target: INSTANT_NOODLE_ROW },
  'mì ly': { lang: 'vi', target: INSTANT_NOODLE_ROW },
  'mì cốc': { lang: 'vi', target: INSTANT_NOODLE_ROW },
  'instant noodles': { lang: 'en', target: INSTANT_NOODLE_ROW },
  'instant noodle': { lang: 'en', target: INSTANT_NOODLE_ROW },
  'instant ramen': { lang: 'en', target: INSTANT_NOODLE_ROW },
  // Carne asada = grilled marinated flank/skirt steak. The dish name has no
  // DB row and no trigram/embedding bridge to the beef-cut rows (golden-set
  // gg-mx-tacos: unmatched → freeform ~80g-protein overestimate). Rewrites to
  // the broiled flank row usda_13948_cooked (verified name_primary,
  // 192 kcal / 27.7 P / 8.2 F per 100g — lean AND fat, all grades).
  'carne asada': {
    lang: 'en',
    target:
      'Thịt bò, phần sườn, bít tết, phần nạc và mỡ tách riêng, đã cắt bỏ phần mỡ (không còn mỡ), đủ mọi loại, đã nấu chín, nướng.',
  },
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
