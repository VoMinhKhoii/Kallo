-- food_card_texts: each card string once, with its vector; food_card_text_rows:
-- which composition rows each string names. Replaces food_card_vectors (one
-- vector per row+string, ~14% of them duplicates), which stays until the
-- release that stopped reading it is deployed. Filled from food_card_vectors in
-- 20261013070600_food_card_texts_index_and_function.sql.
-- Ensure extensions schema is on search_path for the halfvec type
SET search_path TO public, extensions;
--> statement-breakpoint
CREATE TABLE "food_card_text_rows" (
	"text_id" integer NOT NULL,
	"food_composition_id" text NOT NULL,
	CONSTRAINT "food_card_text_rows_text_id_food_composition_id_pk" PRIMARY KEY("text_id","food_composition_id")
);
--> statement-breakpoint
CREATE TABLE "food_card_texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"embedding" halfvec(768),
	CONSTRAINT "food_card_texts_text_unique" UNIQUE("text")
);
--> statement-breakpoint
ALTER TABLE "food_card_text_rows" ADD CONSTRAINT "food_card_text_rows_text_id_food_card_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."food_card_texts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_card_text_rows" ADD CONSTRAINT "food_card_text_rows_food_composition_id_vietnamese_food_composition_id_fk" FOREIGN KEY ("food_composition_id") REFERENCES "public"."vietnamese_food_composition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_card_text_rows_row_idx" ON "food_card_text_rows" USING btree ("food_composition_id");--> statement-breakpoint
CREATE INDEX "food_card_texts_unembedded_idx" ON "food_card_texts" USING btree ("id") WHERE "food_card_texts"."embedding" IS NULL;