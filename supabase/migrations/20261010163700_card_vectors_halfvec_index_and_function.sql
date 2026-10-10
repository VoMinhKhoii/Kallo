-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- After food_card_vectors.embedding became halfvec(768)
-- (20261010163635_card_vectors_halfvec): rebuild the 256-dim search index on
-- the new type and make match_food_cards compare halfvec with halfvec. The
-- search and its scores are unchanged apart from half-precision rounding.
-- =============================================================================

SET search_path TO public, extensions;

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
    SELECT fcv.food_composition_id,
           1 - (fcv.embedding <=> q.v::halfvec(768)) AS sim
    FROM public.food_card_vectors fcv
    ORDER BY subvector(fcv.embedding, 1, 256)::halfvec(256)
      <=> subvector(q.v, 1, 256)::halfvec(256)
    LIMIT per_query
  ) hit
  GROUP BY q.i, hit.food_composition_id;
END;
$$;
