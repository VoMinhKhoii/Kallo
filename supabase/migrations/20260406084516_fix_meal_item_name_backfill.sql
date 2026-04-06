-- Fix: meal_item_name was added as NOT NULL without a backfill path.
-- This migration safely handles existing rows by:
-- 1. Dropping the NOT NULL constraint (in case it was applied)
-- 2. Backfilling NULL values from ingredient_name
-- 3. Re-adding NOT NULL

ALTER TABLE "meal_items" ALTER COLUMN "meal_item_name" DROP NOT NULL;

UPDATE "meal_items"
SET "meal_item_name" = "ingredient_name"
WHERE "meal_item_name" IS NULL;

ALTER TABLE "meal_items" ALTER COLUMN "meal_item_name" SET NOT NULL;
