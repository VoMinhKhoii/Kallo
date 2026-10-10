-- Ensure extensions schema is on search_path for the vector type
SET search_path TO public, extensions;
--> statement-breakpoint
CREATE TABLE "food_card_vectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_composition_id" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "food_cards" (
	"food_composition_id" text PRIMARY KEY NOT NULL,
	"food" text NOT NULL,
	"aliases_en" text[] DEFAULT '{}'::text[] NOT NULL,
	"names_vi" text[] DEFAULT '{}'::text[] NOT NULL,
	"part_cut" text,
	"form_processing" text,
	"cooking_method" text,
	"fat_level" text,
	"brand" text,
	"card" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_card_vectors" ADD CONSTRAINT "food_card_vectors_food_composition_id_vietnamese_food_composition_id_fk" FOREIGN KEY ("food_composition_id") REFERENCES "public"."vietnamese_food_composition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_cards" ADD CONSTRAINT "food_cards_food_composition_id_vietnamese_food_composition_id_fk" FOREIGN KEY ("food_composition_id") REFERENCES "public"."vietnamese_food_composition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_card_vectors_row_text_key" ON "food_card_vectors" USING btree ("food_composition_id","text");