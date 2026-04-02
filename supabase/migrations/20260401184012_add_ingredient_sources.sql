-- =============================================================================
-- Domain A: Schema Structure (Drizzle-managed intent, hand-edited for data migration)
--
-- Creates ingredient_sources reference table and migrates the text `source`
-- column on vietnamese_food_composition to an integer FK `source_id`.
-- =============================================================================

-- 1. Create ingredient_sources table
CREATE TABLE "ingredient_sources" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "ingredient_sources_code_unique" UNIQUE("code")
);

-- 2. Insert known sources (deterministic IDs via explicit INSERT order)
INSERT INTO "ingredient_sources" ("code", "name") VALUES
  ('FAO_VN_2007', 'Vietnamese Food Composition Table 2007 (FAO/INFOODS)'),
  ('USDA_SR', 'USDA FoodData Central — SR Legacy');

-- 3. Add new integer column (nullable initially for migration)
ALTER TABLE "vietnamese_food_composition" ADD COLUMN "source_id" integer;

-- 4. Migrate existing text values → integer FK
-- Map known source text values to integer IDs
-- 'FAO_VN_2007' → 1, anything USDA-related ('USDA_FDC', 'USDA_SR', etc.) → 2
UPDATE "vietnamese_food_composition"
SET "source_id" = CASE
  WHEN "source" LIKE 'USDA%' THEN (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'USDA_SR')
  ELSE (SELECT "id" FROM "ingredient_sources" WHERE "code" = 'FAO_VN_2007')
END;

-- 5. Make source_id NOT NULL with default
ALTER TABLE "vietnamese_food_composition" ALTER COLUMN "source_id" SET NOT NULL;
ALTER TABLE "vietnamese_food_composition" ALTER COLUMN "source_id" SET DEFAULT 1;

-- 6. Add FK constraint
ALTER TABLE "vietnamese_food_composition"
  ADD CONSTRAINT "vietnamese_food_composition_source_id_ingredient_sources_id_fk"
  FOREIGN KEY ("source_id") REFERENCES "public"."ingredient_sources"("id")
  ON DELETE no action ON UPDATE no action;

-- 7. Drop old text column
ALTER TABLE "vietnamese_food_composition" DROP COLUMN "source";
