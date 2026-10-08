-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Read-only RLS for the food-card reference tables, and the HNSW index the
-- card retrieval (lib/ai/matching/cards/) searches with cosine distance.
-- =============================================================================

SET search_path TO public, extensions;

ALTER TABLE public.food_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food cards"
  ON public.food_cards FOR SELECT
  USING (true);

ALTER TABLE public.food_card_vectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food card vectors"
  ON public.food_card_vectors FOR SELECT
  USING (true);

-- HNSW over the first 256 of the 768 dimensions, half precision (same m /
-- ef_construction as idx_food_composition_embedding). gemini-embedding-001 is
-- Matryoshka-trained, so a prefix is a valid embedding: recall@8 on the
-- matching gate was unchanged vs 768 dims (2026-10-08), while the index is
-- ~40 MB instead of ~240 MB and fits shared_buffers on a small instance.
-- match_food_cards rescores the hits with the full 768-dim vectors.
CREATE INDEX IF NOT EXISTS idx_food_card_vectors_embedding_256
  ON public.food_card_vectors
  USING hnsw ((subvector(embedding, 1, 256)::halfvec(256)) halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
