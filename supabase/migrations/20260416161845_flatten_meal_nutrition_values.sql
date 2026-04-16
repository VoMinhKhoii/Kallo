CREATE OR REPLACE FUNCTION __flatten_nutrition_mid(value jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN jsonb_typeof(value) = 'object' THEN NULLIF(value->>'mid', '')::numeric
    WHEN jsonb_typeof(value) = 'number' THEN (value#>>'{}')::numeric
    ELSE NULL
  END
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION __flatten_persisted_macro(value jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN jsonb_typeof(value) = 'number' THEN (value#>>'{}')::numeric
    WHEN jsonb_typeof(value) <> 'object' THEN NULL
    WHEN NULLIF(value->>'low', '')::numeric = NULLIF(value->>'mid', '')::numeric
      AND NULLIF(value->>'mid', '')::numeric = NULLIF(value->>'high', '')::numeric
      THEN NULLIF(value->>'mid', '')::numeric
    ELSE NULL
  END
$$;--> statement-breakpoint

ALTER TABLE "meals"
  ADD COLUMN "calories_kcal_tmp" numeric,
  ADD COLUMN "protein_g_tmp" numeric,
  ADD COLUMN "carbohydrate_g_tmp" numeric,
  ADD COLUMN "fat_g_tmp" numeric;--> statement-breakpoint

ALTER TABLE "meal_items"
  ADD COLUMN "calories_kcal_tmp" numeric,
  ADD COLUMN "protein_g_tmp" numeric,
  ADD COLUMN "carbohydrate_g_tmp" numeric,
  ADD COLUMN "fat_g_tmp" numeric;--> statement-breakpoint

UPDATE "meals" AS meal
SET
  "calories_kcal_tmp" = __flatten_persisted_macro(meal."calories_kcal"),
  "protein_g_tmp" = __flatten_persisted_macro(meal."protein_g"),
  "carbohydrate_g_tmp" = __flatten_persisted_macro(meal."carbohydrate_g"),
  "fat_g_tmp" = __flatten_persisted_macro(meal."fat_g");--> statement-breakpoint

UPDATE "meal_items" AS item
SET
  "calories_kcal_tmp" = CASE
    WHEN __flatten_persisted_macro(meal."calories_kcal") IS NULL THEN NULL
    ELSE __flatten_persisted_macro(item."calories_kcal")
  END,
  "protein_g_tmp" = CASE
    WHEN __flatten_persisted_macro(meal."protein_g") IS NULL THEN NULL
    ELSE __flatten_persisted_macro(item."protein_g")
  END,
  "carbohydrate_g_tmp" = CASE
    WHEN __flatten_persisted_macro(meal."carbohydrate_g") IS NULL THEN NULL
    ELSE __flatten_persisted_macro(item."carbohydrate_g")
  END,
  "fat_g_tmp" = CASE
    WHEN __flatten_persisted_macro(meal."fat_g") IS NULL THEN NULL
    ELSE __flatten_persisted_macro(item."fat_g")
  END
FROM "meals" AS meal
WHERE meal."id" = item."meal_id";--> statement-breakpoint

ALTER TABLE "meal_items"
  ALTER COLUMN "fiber_g" SET DATA TYPE numeric USING (__flatten_nutrition_mid("fiber_g")),
  ALTER COLUMN "sodium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("sodium_mg")),
  ALTER COLUMN "calcium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("calcium_mg")),
  ALTER COLUMN "iron_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("iron_mg")),
  ALTER COLUMN "magnesium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("magnesium_mg")),
  ALTER COLUMN "phosphorus_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("phosphorus_mg")),
  ALTER COLUMN "potassium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("potassium_mg")),
  ALTER COLUMN "zinc_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("zinc_mg")),
  ALTER COLUMN "copper_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("copper_mcg")),
  ALTER COLUMN "manganese_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("manganese_mg")),
  ALTER COLUMN "beta_carotene_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("beta_carotene_mcg")),
  ALTER COLUMN "vitamin_a_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_a_mcg")),
  ALTER COLUMN "vitamin_d_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_d_mcg")),
  ALTER COLUMN "vitamin_e_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_e_mg")),
  ALTER COLUMN "vitamin_k_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_k_mcg")),
  ALTER COLUMN "vitamin_c_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_c_mg")),
  ALTER COLUMN "vitamin_b1_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b1_mg")),
  ALTER COLUMN "vitamin_b2_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b2_mg")),
  ALTER COLUMN "vitamin_pp_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_pp_mg")),
  ALTER COLUMN "vitamin_b5_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b5_mg")),
  ALTER COLUMN "vitamin_b6_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b6_mg")),
  ALTER COLUMN "vitamin_b9_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b9_mcg")),
  ALTER COLUMN "vitamin_b12_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b12_mcg")),
  ALTER COLUMN "vitamin_h_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_h_mcg"));--> statement-breakpoint

ALTER TABLE "meals"
  ALTER COLUMN "fiber_g" SET DATA TYPE numeric USING (__flatten_nutrition_mid("fiber_g")),
  ALTER COLUMN "sodium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("sodium_mg")),
  ALTER COLUMN "calcium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("calcium_mg")),
  ALTER COLUMN "iron_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("iron_mg")),
  ALTER COLUMN "magnesium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("magnesium_mg")),
  ALTER COLUMN "phosphorus_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("phosphorus_mg")),
  ALTER COLUMN "potassium_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("potassium_mg")),
  ALTER COLUMN "zinc_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("zinc_mg")),
  ALTER COLUMN "copper_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("copper_mcg")),
  ALTER COLUMN "manganese_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("manganese_mg")),
  ALTER COLUMN "beta_carotene_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("beta_carotene_mcg")),
  ALTER COLUMN "vitamin_a_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_a_mcg")),
  ALTER COLUMN "vitamin_d_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_d_mcg")),
  ALTER COLUMN "vitamin_e_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_e_mg")),
  ALTER COLUMN "vitamin_k_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_k_mcg")),
  ALTER COLUMN "vitamin_c_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_c_mg")),
  ALTER COLUMN "vitamin_b1_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b1_mg")),
  ALTER COLUMN "vitamin_b2_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b2_mg")),
  ALTER COLUMN "vitamin_pp_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_pp_mg")),
  ALTER COLUMN "vitamin_b5_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b5_mg")),
  ALTER COLUMN "vitamin_b6_mg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b6_mg")),
  ALTER COLUMN "vitamin_b9_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b9_mcg")),
  ALTER COLUMN "vitamin_b12_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_b12_mcg")),
  ALTER COLUMN "vitamin_h_mcg" SET DATA TYPE numeric USING (__flatten_nutrition_mid("vitamin_h_mcg"));--> statement-breakpoint

ALTER TABLE "meal_items"
  DROP COLUMN "calories_kcal",
  DROP COLUMN "protein_g",
  DROP COLUMN "carbohydrate_g",
  DROP COLUMN "fat_g";--> statement-breakpoint

ALTER TABLE "meals"
  DROP COLUMN "calories_kcal",
  DROP COLUMN "protein_g",
  DROP COLUMN "carbohydrate_g",
  DROP COLUMN "fat_g";--> statement-breakpoint

ALTER TABLE "meal_items" RENAME COLUMN "calories_kcal_tmp" TO "calories_kcal";--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "protein_g_tmp" TO "protein_g";--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "carbohydrate_g_tmp" TO "carbohydrate_g";--> statement-breakpoint
ALTER TABLE "meal_items" RENAME COLUMN "fat_g_tmp" TO "fat_g";--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "calories_kcal_tmp" TO "calories_kcal";--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "protein_g_tmp" TO "protein_g";--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "carbohydrate_g_tmp" TO "carbohydrate_g";--> statement-breakpoint
ALTER TABLE "meals" RENAME COLUMN "fat_g_tmp" TO "fat_g";--> statement-breakpoint

DROP FUNCTION __flatten_persisted_macro(jsonb);--> statement-breakpoint
DROP FUNCTION __flatten_nutrition_mid(jsonb);
