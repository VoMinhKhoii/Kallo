SET search_path TO public, extensions;

-- Repair FAO VN 2007 beverage rows whose recorded calories omitted ethanol's
-- 7 kcal/g contribution. Targets are the values verified against NIN 2017;
-- published NIN values take precedence where the row-label recomputation differs.
-- Rượu trắng (14012) remains untouched: 0 + 7 * 39 = 273 kcal is already correct.

-- Bia: 11 + 7 * 4.5 = 42.5 kcal; NIN publishes the rounded value 43 kcal.
UPDATE vietnamese_food_composition
SET calories_kcal = 43
WHERE id = 'fao_vn_2007_14001_raw' AND calories_kcal = 11;

-- Cô nhắc: 0 + 7 * 32 = 224 kcal.
UPDATE vietnamese_food_composition
SET calories_kcal = 224
WHERE id = 'fao_vn_2007_14002_raw' AND calories_kcal = 0;

-- Cốc tai: 63 + 7 * 13 = 154 kcal.
UPDATE vietnamese_food_composition
SET calories_kcal = 154
WHERE id = 'fao_vn_2007_14003_raw' AND calories_kcal = 63;

-- Rượu cam, chanh: 0 + 7 * 24.2 = 169.4 kcal; NIN publishes 241 kcal
-- because the liqueur's energy also includes sugar, so prefer NIN's value.
UPDATE vietnamese_food_composition
SET calories_kcal = 241
WHERE id = 'fao_vn_2007_14010_raw' AND calories_kcal = 0;

-- Rượu nếp: 167 + 7 * 5 = 202 kcal.
UPDATE vietnamese_food_composition
SET calories_kcal = 202
WHERE id = 'fao_vn_2007_14011_raw' AND calories_kcal = 167;

-- Rượu vang đỏ: 9 + 7 * 9.5 = 75.5 kcal; NIN publishes 69 kcal,
-- so prefer NIN's verified value.
UPDATE vietnamese_food_composition
SET calories_kcal = 69
WHERE id = 'fao_vn_2007_14013_raw' AND calories_kcal = 9;

-- Rượu vang trắng: 1 + 7 * 9.5 = 67.5 kcal; NIN publishes 66 kcal,
-- so prefer NIN's verified value.
UPDATE vietnamese_food_composition
SET calories_kcal = 66
WHERE id = 'fao_vn_2007_14014_raw' AND calories_kcal = 1;

-- Rượu vang trắng ngọt: 24 + 7 * 10.2 = 95.4 kcal; NIN publishes
-- 96 kcal, so prefer NIN's verified value.
UPDATE vietnamese_food_composition
SET calories_kcal = 96
WHERE id = 'fao_vn_2007_14015_raw' AND calories_kcal = 24;

-- Rượu Whisky: 0 + 7 * 35.2 = 246.4 kcal; NIN publishes 246 kcal.
UPDATE vietnamese_food_composition
SET calories_kcal = 246
WHERE id = 'fao_vn_2007_14016_raw' AND calories_kcal = 0;
