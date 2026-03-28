-- Add sả (lemongrass) and hành tím (shallot) to vietnamese_food_composition.
-- These staple Vietnamese cooking ingredients are absent from VTN FCT 2007.
-- Data source: USDA FoodData Central (NDB 11972 and NDB 11677).
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
  'usda_11972_raw', 'Sả', '{"Cây sả", "Sả chanh"}', 'Lemongrass (citronella), raw',
  'Rau và sản phẩm chế biến', 'Vegetable and products', 'USDA_FDC', 'raw',
  0.0, 99.0, 1.8, 25.3, 0.5, 0.0,
  6.0, 65.0, 8.2, 60.0, 101.0, 723.0,
  2.2, 266.0, 5.2,
  3.0, 0.0, NULL, NULL, NULL,
  2.6, 0.065, 0.135, 1.1,
  0.05, 0.08, 75.0, 0.0, NULL,
  '2026-03-18'
),
(
  'usda_11677_raw', 'Hành tím', '{"Hành khô", "Hành hương"}', 'Shallots, raw',
  'Rau và sản phẩm chế biến', 'Vegetable and products', 'USDA_FDC', 'raw',
  10.0, 72.0, 2.5, 16.8, 0.1, 3.2,
  12.0, 37.0, 1.2, 21.0, 60.0, 334.0,
  0.4, 88.0, 0.3,
  3.0, 0.0, NULL, 0.04, 0.8,
  8.0, 0.06, 0.02, 0.2,
  0.29, 0.345, 34.0, 0.0, NULL,
  '2026-03-18'
)
ON CONFLICT (id) DO NOTHING;
