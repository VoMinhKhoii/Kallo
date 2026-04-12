-- Add source-aware matching functions for FAO-first, USDA-fallback cascade.
-- These overloads accept an optional p_source_id parameter to filter by source.
-- The original functions (without p_source_id) remain unchanged for backward compat.

SET search_path TO public, extensions;

-- Vector match filtered by source_id
CREATE OR REPLACE FUNCTION public.match_ingredients_by_source(
  query_embedding vector(768),
  p_source_id int,
  match_count int DEFAULT 3,
  match_threshold float DEFAULT 0.5
) RETURNS TABLE (
  id text,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  source_id int,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vfc.id,
    vfc.name_primary,
    vfc.name_alt,
    vfc.name_en,
    vfc.state,
    vfc.source_id,
    1 - (vfc.embedding <=> query_embedding)::float AS similarity
  FROM public.vietnamese_food_composition vfc
  WHERE vfc.embedding IS NOT NULL
    AND vfc.source_id = p_source_id
    AND 1 - (vfc.embedding <=> query_embedding)::float >= match_threshold
  ORDER BY vfc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fuzzy match filtered by source_id
CREATE OR REPLACE FUNCTION public.fuzzy_match_ingredients_by_source(
  query_text text,
  p_source_id int,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.15
) RETURNS TABLE (
  id text,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  source_id int,
  similarity float
) AS $$
DECLARE
  has_diacritics boolean;
  normalized_query text;
BEGIN
  normalized_query := lower(extensions.unaccent(query_text));
  has_diacritics := (normalized_query IS DISTINCT FROM lower(query_text));

  IF has_diacritics THEN
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      vfc.source_id,
      GREATEST(
        extensions.similarity(vfc.name_primary, query_text),
        extensions.similarity(COALESCE(array_to_string(vfc.name_alt, ' '), ''), query_text),
        extensions.similarity(COALESCE(vfc.name_en, ''), query_text)
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE vfc.source_id = p_source_id
      AND extensions.word_similarity(query_text, vfc.search_text) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      vfc.source_id,
      GREATEST(
        extensions.similarity(lower(extensions.unaccent(vfc.name_primary)), normalized_query),
        extensions.similarity(lower(extensions.unaccent(COALESCE(array_to_string(vfc.name_alt, ' '), ''))), normalized_query),
        extensions.similarity(lower(COALESCE(vfc.name_en, '')), normalized_query)
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE vfc.source_id = p_source_id
      AND extensions.word_similarity(normalized_query, vfc.search_text_ascii) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
