-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Fill food_card_texts / food_card_text_rows from food_card_vectors (each
-- string once; the existing vectors are reused, nothing is re-embedded), then
-- read-only RLS, the 256-dim search index, and match_food_card_texts.
-- food_card_vectors and match_food_cards stay for the revision still serving
-- while this deploy runs; a later migration drops them.
-- =============================================================================

SET search_path TO public, extensions;

-- One vector per string: any copy with an embedding (all copies of a string
-- embed to the same vector), else NULL for the backfill.
INSERT INTO public.food_card_texts (text, embedding)
SELECT DISTINCT ON (text) text, embedding
FROM public.food_card_vectors
ORDER BY text, (embedding IS NULL), id
ON CONFLICT (text) DO NOTHING;

INSERT INTO public.food_card_text_rows (text_id, food_composition_id)
SELECT t.id, v.food_composition_id
FROM public.food_card_vectors v
JOIN public.food_card_texts t ON t.text = v.text
ON CONFLICT DO NOTHING;

ALTER TABLE public.food_card_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food card texts"
  ON public.food_card_texts FOR SELECT
  USING (true);

ALTER TABLE public.food_card_text_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food card text rows"
  ON public.food_card_text_rows FOR SELECT
  USING (true);

-- Same index shape as idx_food_card_vectors_embedding_256: HNSW over the first
-- 256 of 768 dims (gemini-embedding-001 is Matryoshka-trained), half precision.
-- Built after the bulk insert, which is faster than maintaining it row by row.
CREATE INDEX IF NOT EXISTS idx_food_card_texts_embedding_256
  ON public.food_card_texts
  USING hnsw ((subvector(embedding, 1, 256)::halfvec(256)) halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- The nearest `per_query` distinct strings per query vector (256-dim prefix
-- search, rescored with all 768 dims), expanded to every row each names; a row
-- keeps its best string's similarity. Searching distinct strings means a name
-- shared by many rows takes one of the per_query slots, not one per row.
CREATE OR REPLACE FUNCTION public.match_food_card_texts(
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
  SELECT q.i::integer, r.food_composition_id, max(hit.sim)::double precision
  FROM unnest(query_embeddings) WITH ORDINALITY AS q(v, i)
  CROSS JOIN LATERAL (
    SELECT t.id,
           1 - (t.embedding <=> q.v::halfvec(768)) AS sim
    FROM public.food_card_texts t
    ORDER BY subvector(t.embedding, 1, 256)::halfvec(256)
      <=> subvector(q.v, 1, 256)::halfvec(256)
    LIMIT per_query
  ) hit
  JOIN public.food_card_text_rows r ON r.text_id = hit.id
  GROUP BY q.i, r.food_composition_id;
END;
$$;
