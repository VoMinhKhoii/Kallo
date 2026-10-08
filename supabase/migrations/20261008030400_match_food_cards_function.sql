-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- match_food_cards: nearest card strings for a batch of query vectors, scored
-- per row by its best string (max-sim). One round trip for a whole meal item.
-- hnsw.ef_search is raised for the call only: HNSW returns at most
-- ef_search results, and a row owns ~9 strings, so the default 40 would cap a
-- query at a handful of distinct rows.
-- =============================================================================

SET search_path TO public, extensions;

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
