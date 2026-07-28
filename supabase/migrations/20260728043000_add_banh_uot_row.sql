-- Add bánh ướt (steamed rice sheets) to vietnamese_food_composition.
-- Bánh ướt (and its thicker filled sibling bánh cuốn) are absent from VN FCT
-- 2007. They are the same rice-flour batter steamed as thin sheets, so USDA
-- "Rice noodles, cooked" is used as a proxy (identical cooked rice-flour base).
-- Data source: USDA FoodData Central (NDB 20134 / FDC ID 168914).
-- Embeddings will be generated on next pipeline run or via backfill script.

SET search_path TO public, extensions;

INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source, state,
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
  'Ngũ cốc và sản phẩm chế biến', 'Cereal and products', 'USDA_FDC', 'cooked',
  0.0, 108.0, 1.79, 24.01, 0.2, 1.0,
  19.0, 4.0, 0.14, NULL, 20.0, 4.0,
  0.25, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-07-22'
)
ON CONFLICT (id) DO NOTHING;
