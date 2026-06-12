-- Manual-logging ingredient search: rank with word_similarity instead of
-- whole-string similarity.
--
-- Problem: fuzzy_match_ingredients ranks with similarity(name, query), which
-- compares the FULL strings. Translated USDA entries carry long descriptive
-- names (e.g. "Gà, gà giò, ức, chỉ thịt, sống") and multi-variant name_alt
-- arrays joined into one blob — both get crushed by the length mismatch
-- against a short query like "ức gà", so short generic FAO names ("Thịt gà
-- ta") outrank the actual chicken-breast entries. Body-part foods exist in
-- the dataset (USDA, translated + name_alt variants) but never surface.
--
-- Fix, for the manual-search surface only (the AI matching pipeline keeps
-- fuzzy_match_ingredients):
--   - rank with word_similarity(query, name): the query against the BEST
--     MATCHING EXTENT of the name, so "ức gà" inside a long name scores ~1;
--   - score name_alt per element (MAX over unnest) instead of the joined
--     blob, so one exact variant ("ức gà") is a full-strength hit;
--   - tiebreak by source (curated FAO first), then shorter name first.
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.search_ingredients_by_name(
  query_text text,
  match_count int DEFAULT 10,
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
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      GREATEST(
        extensions.word_similarity(query_text, vfc.name_primary),
        COALESCE(
          (SELECT MAX(extensions.word_similarity(query_text, alt))
           FROM unnest(vfc.name_alt) AS alt),
          0
        ),
        extensions.word_similarity(query_text, COALESCE(vfc.name_en, ''))
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE extensions.word_similarity(query_text, vfc.search_text) >= match_threshold
    -- ORDER BY 6 = the similarity output column (positional to avoid the
    -- plpgsql OUT-variable name clash).
    ORDER BY 6 DESC, vfc.source_id ASC, length(vfc.name_primary) ASC
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      GREATEST(
        extensions.word_similarity(
          normalized_query, lower(extensions.unaccent(vfc.name_primary))
        ),
        COALESCE(
          (SELECT MAX(
             extensions.word_similarity(
               normalized_query, lower(extensions.unaccent(alt))
             )
           )
           FROM unnest(vfc.name_alt) AS alt),
          0
        ),
        extensions.word_similarity(
          normalized_query, lower(COALESCE(vfc.name_en, ''))
        )
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE extensions.word_similarity(normalized_query, vfc.search_text_ascii) >= match_threshold
    ORDER BY 6 DESC, vfc.source_id ASC, length(vfc.name_primary) ASC
    LIMIT match_count;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
