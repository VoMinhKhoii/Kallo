-- Fix: fuzzy_match_ingredients ranking was diluted by English text in search_text.
-- Now uses word_similarity for broad filtering and per-column similarity for precise ranking.
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.fuzzy_match_ingredients(
  query_text text,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.15
) RETURNS TABLE (
  id text,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  similarity float
) AS $$
DECLARE
  has_diacritics boolean;
  normalized_query text;
BEGIN
  normalized_query := lower(extensions.unaccent(query_text));
  has_diacritics := (normalized_query IS DISTINCT FROM lower(query_text));

  IF has_diacritics THEN
    -- Vietnamese input with diacritics
    -- Filter: word_similarity catches matches via any column (name, alt, English)
    -- Rank: best per-column similarity avoids English text dilution
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      GREATEST(
        extensions.similarity(vfc.name_primary, query_text),
        extensions.similarity(COALESCE(array_to_string(vfc.name_alt, ' '), ''), query_text),
        extensions.similarity(COALESCE(vfc.name_en, ''), query_text)
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE extensions.word_similarity(query_text, vfc.search_text) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  ELSE
    -- ASCII input (English or unaccented Vietnamese)
    -- Same two-stage: broad filter + per-column ranking
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      GREATEST(
        extensions.similarity(lower(extensions.unaccent(vfc.name_primary)), normalized_query),
        extensions.similarity(lower(extensions.unaccent(COALESCE(array_to_string(vfc.name_alt, ' '), ''))), normalized_query),
        extensions.similarity(lower(COALESCE(vfc.name_en, '')), normalized_query)
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE extensions.word_similarity(normalized_query, vfc.search_text_ascii) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
