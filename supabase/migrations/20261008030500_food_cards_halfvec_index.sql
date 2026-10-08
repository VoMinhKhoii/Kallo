-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Brings databases that ran the first version of the food-card migrations
-- (full-precision 768-dim index, per_query 200) to the 256-dim half-precision
-- index and the
-- matching match_food_cards. A fresh database already has both, so every
-- statement here is a no-op or an identical replace there.
-- =============================================================================

SET search_path TO public, extensions;
-- Rebuilding over already-embedded vectors (dev) outlasts the default
-- statement timeout and maintenance_work_mem; a fresh database skips it.
SET statement_timeout = 0;
SET maintenance_work_mem = '128MB';
SET max_parallel_maintenance_workers = 0;

DROP INDEX IF EXISTS public.idx_food_card_vectors_embedding;
DROP INDEX IF EXISTS public.idx_food_card_vectors_embedding_half;

CREATE INDEX IF NOT EXISTS idx_food_card_vectors_embedding_256
  ON public.food_card_vectors
  USING hnsw ((subvector(embedding, 1, 256)::halfvec(256)) halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION public.match_food_cards(
  query_embeddings vector[],
  per_query integer DEFAULT 100
)
RETURNS TABLE(query_index integer, food_composition_id text, similarity double precision)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  -- Transaction-local; a function-level SET clause needs a superuser on
  -- Supabase, set_config does not.
  PERFORM set_config('hnsw.ef_search', per_query::text, true);
  RETURN QUERY
  SELECT q.i::integer, hit.food_composition_id, max(hit.sim)::double precision
  FROM unnest(query_embeddings) WITH ORDINALITY AS q(v, i)
  CROSS JOIN LATERAL (
    SELECT fcv.food_composition_id, 1 - (fcv.embedding <=> q.v) AS sim
    FROM public.food_card_vectors fcv
    ORDER BY subvector(fcv.embedding, 1, 256)::halfvec(256)
      <=> subvector(q.v, 1, 256)::halfvec(256)
    LIMIT per_query
  ) hit
  GROUP BY q.i, hit.food_composition_id;
END;
$$;
