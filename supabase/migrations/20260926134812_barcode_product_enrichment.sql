ALTER TABLE "vietnamese_food_composition" ADD COLUMN "amount_unit" text;--> statement-breakpoint
ALTER TABLE "vietnamese_food_composition" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "vietnamese_food_composition" ADD COLUMN "barcode_data_version" smallint;--> statement-breakpoint
ALTER TABLE "vietnamese_food_composition" ADD CONSTRAINT "vietnamese_food_composition_amount_unit_check" CHECK ("vietnamese_food_composition"."amount_unit" IN ('g', 'ml'));