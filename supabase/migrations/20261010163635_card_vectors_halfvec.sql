-- food_card_vectors.embedding: vector(768) -> halfvec(768).
-- The full-precision vectors were ~280 MB of out-of-line storage for a
-- reference table; half precision keeps every dimension (match_food_cards
-- rescores with all 768) at a cosine error around 1e-3. The search index is
-- defined on the old type, so it is dropped here and rebuilt on the new one
-- in the following manual migration, together with the function.
-- Ensure extensions schema is on search_path for the halfvec type
SET search_path TO public, extensions;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_food_card_vectors_embedding_256";--> statement-breakpoint
ALTER TABLE "food_card_vectors" ALTER COLUMN "embedding" SET DATA TYPE halfvec(768) USING "embedding"::halfvec(768);
