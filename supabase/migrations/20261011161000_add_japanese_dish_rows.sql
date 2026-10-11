-- Japanese dishes the catalog lacked, from a prod meal that went wrong
-- ("cơm + trứng chiên phủ + cà ri + 1 miếng tôm tonkatsu + 1/2 miếng heo
-- tonkatsu + 1 chén soup miso"): miso soup matched MISO PASTE (198 kcal/100 g)
-- for a whole bowl, curry matched CURRY POWDER, and no breaded fried pork row
-- existed at all. Rows are copied verbatim from the official tables below
-- (drafted by one curator, every value re-read from the source files by a
-- second; see each row's comment). Unreported nutrients are NULL; MEXT "Tr" is
-- 0 and its parenthesised estimates are used as published.
--
-- Two new sources join ingredient matching through MATCHING_SOURCE_BUCKETS
-- (lib/ai/matching/match-constants.ts). Embeddings and card vectors are filled
-- by the deploy's backfills; the cards arrive in the next migration.

SET search_path TO public, extensions;

INSERT INTO "ingredient_sources" ("code", "name") VALUES
  ('USDA_FNDDS', 'USDA FoodData Central — Survey (FNDDS) 2021–2023'),
  ('MEXT_2020', 'Standard Tables of Food Composition in Japan 2020 (8th revised edition), MEXT')
ON CONFLICT ("code") DO NOTHING;

-- fndds_41601070: USDA FoodData Central, Survey (FNDDS) 2021-2023 FDC 2707455 / food code 41601070 — Soup, miso or tofu
--   https://fdc.nal.usda.gov/food-details/2707455/nutrients
INSERT INTO "vietnamese_food_composition" (
  "id", "name_primary", "name_alt", "name_en", "type_vn", "type_en", "source_id", "state", "inedible_portion_pct", "calories_kcal", "protein_g", "carbohydrate_g", "fat_g", "fiber_g", "sodium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg", "potassium_mg", "zinc_mg", "copper_mcg", "manganese_mg", "beta_carotene_mcg", "vitamin_a_mcg", "vitamin_d_mcg", "vitamin_e_mg", "vitamin_k_mcg", "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_pp_mg", "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b9_mcg", "vitamin_b12_mcg", "vitamin_h_mcg", "last_verified"
) VALUES (
  'fndds_41601070',
  'Súp miso',
  ARRAY['canh miso', 'súp tương miso', 'canh tương miso', 'soup miso', 'súp miso đậu hũ']::text[],
  'Soup, miso or tofu (prepared, as served)',
  'Canh, nước sốt và nước dùng',
  'Soups, Sauces, and Gravies',
  (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'USDA_FNDDS'),
  'cooked',
  NULL,
  24.0,
  2.21,
  2.3,
  0.85,
  0.6,
  467.0,
  25.0,
  0.47,
  8.0,
  27.0,
  77.0,
  0.26,
  51.0,
  NULL,
  63.0,
  5.0,
  0.0,
  0.07,
  22.4,
  1.9,
  0.024,
  0.053,
  0.526,
  NULL,
  0.025,
  12.0,
  0.04,
  NULL,
  '2026-10-11'
)
ON CONFLICT ("id") DO NOTHING;

-- mext_11276: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev.) 11276 — ＜畜肉類＞ ぶた ［大型種肉］ ロース 脂身つき とんかつ
--   https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11276_8
INSERT INTO "vietnamese_food_composition" (
  "id", "name_primary", "name_alt", "name_en", "type_vn", "type_en", "source_id", "state", "inedible_portion_pct", "calories_kcal", "protein_g", "carbohydrate_g", "fat_g", "fiber_g", "sodium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg", "potassium_mg", "zinc_mg", "copper_mcg", "manganese_mg", "beta_carotene_mcg", "vitamin_a_mcg", "vitamin_d_mcg", "vitamin_e_mg", "vitamin_k_mcg", "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_pp_mg", "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b9_mcg", "vitamin_b12_mcg", "vitamin_h_mcg", "last_verified"
) VALUES (
  'mext_11276',
  'Thịt thăn heo chiên xù kiểu Nhật (tonkatsu)',
  ARRAY['tonkatsu', 'heo chiên xù', 'thịt heo chiên xù kiểu Nhật', 'heo tonkatsu', 'thịt lợn chiên xù', 'cốt lết heo chiên xù', 'katsu heo']::text[],
  'Pork, loin, lean and fat, tonkatsu (breaded and deep-fried)',
  'Thịt lợn',
  'Pork Products',
  (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'MEXT_2020'),
  'cooked',
  0.0,
  429.0,
  22.0,
  9.8,
  35.9,
  0.7,
  110.0,
  14.0,
  0.6,
  27.0,
  200.0,
  340.0,
  1.9,
  70.0,
  0.12,
  6.0,
  11.0,
  0.7,
  3.5,
  16.0,
  1.0,
  0.75,
  0.15,
  7.0,
  0.79,
  0.31,
  6.0,
  0.5,
  5.0,
  '2026-10-11'
)
ON CONFLICT ("id") DO NOTHING;

-- mext_18020: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev.) 18020 — 洋風料理 フライ類 えびフライ
--   https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=18_18020_8
INSERT INTO "vietnamese_food_composition" (
  "id", "name_primary", "name_alt", "name_en", "type_vn", "type_en", "source_id", "state", "inedible_portion_pct", "calories_kcal", "protein_g", "carbohydrate_g", "fat_g", "fiber_g", "sodium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg", "potassium_mg", "zinc_mg", "copper_mcg", "manganese_mg", "beta_carotene_mcg", "vitamin_a_mcg", "vitamin_d_mcg", "vitamin_e_mg", "vitamin_k_mcg", "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_pp_mg", "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b9_mcg", "vitamin_b12_mcg", "vitamin_h_mcg", "last_verified"
) VALUES (
  'mext_18020',
  'Tôm chiên xù kiểu Nhật (ebi fry)',
  ARRAY['ebi fry', 'ebi furai', 'tôm chiên xù kiểu Nhật']::text[],
  'Prepared foods, breaded prawn (ebi fry), fried, from frozen',
  'Cá và hải sản',
  'Finfish and Shellfish Products',
  (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'MEXT_2020'),
  'cooked',
  0.0,
  236.0,
  15.9,
  20.5,
  11.6,
  1.0,
  340.0,
  69.0,
  0.6,
  36.0,
  200.0,
  200.0,
  1.3,
  380.0,
  0.18,
  1.0,
  13.0,
  0.2,
  2.2,
  16.0,
  0.0,
  0.08,
  0.05,
  2.0,
  0.57,
  0.05,
  22.0,
  0.6,
  3.2,
  '2026-10-11'
)
ON CONFLICT ("id") DO NOTHING;

-- mext_18041: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev.) 18041 — 洋風料理 カレー類 ポークカレー
--   https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=18_18041_8
INSERT INTO "vietnamese_food_composition" (
  "id", "name_primary", "name_alt", "name_en", "type_vn", "type_en", "source_id", "state", "inedible_portion_pct", "calories_kcal", "protein_g", "carbohydrate_g", "fat_g", "fiber_g", "sodium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg", "potassium_mg", "zinc_mg", "copper_mcg", "manganese_mg", "beta_carotene_mcg", "vitamin_a_mcg", "vitamin_d_mcg", "vitamin_e_mg", "vitamin_k_mcg", "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_pp_mg", "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b9_mcg", "vitamin_b12_mcg", "vitamin_h_mcg", "last_verified"
) VALUES (
  'mext_18041',
  'Cà ri heo kiểu Nhật',
  ARRAY['cà ri heo Nhật', 'kare heo', 'sốt cà ri heo kiểu Nhật']::text[],
  'Japanese curry, pork (prepared, with meat and vegetables)',
  'Canh, nước sốt và nước dùng',
  'Soups, Sauces, and Gravies',
  (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'MEXT_2020'),
  'cooked',
  0.0,
  116.0,
  2.8,
  7.7,
  8.6,
  0.9,
  550.0,
  14.0,
  0.5,
  7.0,
  32.0,
  100.0,
  0.3,
  40.0,
  0.1,
  250.0,
  26.0,
  0.1,
  0.4,
  3.0,
  2.0,
  0.07,
  0.03,
  0.7,
  0.16,
  0.06,
  5.0,
  0.1,
  1.3,
  '2026-10-11'
)
ON CONFLICT ("id") DO NOTHING;

-- mext_18001: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev.) 18001 — 洋風料理 カレー類 ビーフカレー
--   https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=18_18001_8
INSERT INTO "vietnamese_food_composition" (
  "id", "name_primary", "name_alt", "name_en", "type_vn", "type_en", "source_id", "state", "inedible_portion_pct", "calories_kcal", "protein_g", "carbohydrate_g", "fat_g", "fiber_g", "sodium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg", "potassium_mg", "zinc_mg", "copper_mcg", "manganese_mg", "beta_carotene_mcg", "vitamin_a_mcg", "vitamin_d_mcg", "vitamin_e_mg", "vitamin_k_mcg", "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_pp_mg", "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b9_mcg", "vitamin_b12_mcg", "vitamin_h_mcg", "last_verified"
) VALUES (
  'mext_18001',
  'Cà ri bò kiểu Nhật đóng gói',
  ARRAY['cà ri bò Nhật', 'kare bò', 'beef kare', 'cà ri bò đóng gói kiểu Nhật']::text[],
  'Japanese curry, beef (retort-pouch, with meat and vegetables)',
  'Canh, nước sốt và nước dùng',
  'Soups, Sauces, and Gravies',
  (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'MEXT_2020'),
  'cooked',
  0.0,
  119.0,
  2.4,
  8.1,
  9.0,
  0.9,
  680.0,
  20.0,
  0.7,
  8.0,
  32.0,
  93.0,
  0.4,
  40.0,
  0.12,
  75.0,
  9.0,
  0.0,
  0.4,
  3.0,
  1.0,
  0.02,
  0.03,
  0.4,
  0.14,
  0.05,
  4.0,
  0.2,
  0.9,
  '2026-10-11'
)
ON CONFLICT ("id") DO NOTHING;
