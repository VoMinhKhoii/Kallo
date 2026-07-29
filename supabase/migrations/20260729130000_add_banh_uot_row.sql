-- Add bánh ướt (steamed rice sheets) to vietnamese_food_composition.
-- Bánh ướt is absent from VN FCT 2007. It is plain rice-flour batter steamed
-- into thin sheets, so USDA "Rice noodles, cooked" is used as a proxy
-- (identical cooked rice-flour base).
-- "Bánh cuốn" is an alias on purpose, even though that dish carries a filling.
-- Matching is INGREDIENT-level, not dish-level: Call 1 decomposes "bánh cuốn
-- chả lụa" into the sheet plus its filling and toppings as separate
-- ingredients, so this row only ever supplies the sheet — which really is plain
-- rice batter. The filling is costed on its own rows (see the
-- gvn-banh-cuon-full fixture, which expects 14-30 g protein). Keeping the alias
-- here also feeds the embedding text, catching near misses like "vỏ bánh cuốn"
-- that the exact-match table in lib/ai/matching/aliases.ts does not cover.
-- Data source: USDA FoodData Central (NDB 20134 / FDC ID 168914).
-- The embedding is left NULL here and filled by scripts/backfill_embeddings.ts,
-- which the prod deploy runs whenever any row still lacks one.

SET search_path TO public, extensions;

INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source_id, state,
  inedible_portion_pct, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
  sodium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg,
  zinc_mg, copper_mcg, manganese_mg,
  beta_carotene_mcg, vitamin_a_mcg, vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg,
  vitamin_c_mg, vitamin_b1_mg, vitamin_b2_mg, vitamin_pp_mg,
  vitamin_b5_mg, vitamin_b6_mg, vitamin_b9_mcg, vitamin_b12_mcg, vitamin_h_mcg,
  last_verified
) VALUES
(
  'usda_20134_cooked', 'Bánh ướt', '{"Bánh cuốn", "Bánh ướt chay"}', 'Steamed rice sheets (rice noodles, cooked)',
  'Ngũ cốc và sản phẩm chế biến', 'Cereal and products',
  (SELECT id FROM ingredient_sources WHERE code = 'USDA_SR'), 'cooked',
  0.0, 108.0, 1.79, 24.01, 0.2, 1.0,
  19.0, 4.0, 0.14, NULL, 20.0, 4.0,
  0.25, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-07-22'
)
ON CONFLICT (id) DO NOTHING;
