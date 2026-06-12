-- Single-statement, source-aware ingredient retrieval with word-extent
-- ranking. Serves BOTH the manual-logging search endpoint and the v2 AI
-- matcher, so the ranking algorithm lives in exactly one place.
--
-- 1. match_ingredients_all_sources — the v2 matcher previously fired two
--    statements per ingredient (match_ingredients_by_source for FAO, then
--    USDA), each shipping the same ~15-20KB embedding literal. One statement
--    returns the top N per source via a window partition: half the round
--    trips and half the bytes on the hottest pipeline path.
--
-- 2. fuzzy_match_ingredients_all_sources — same single-statement shape for
--    the trigram arm, with fixed ranking: score with word_similarity (the
--    query vs the BEST-MATCHING EXTENT of the name) and name_alt scored per
--    element (MAX over unnest) instead of whole-string similarity over a
--    joined blob. The old whole-string scoring crushed long translated USDA
--    names (e.g. "Gà, gà giò, ức, chỉ thịt, sống") against short queries
--    like "ức gà", so short generic FAO names always won and body-part
--    entries never surfaced — and made it practically impossible for those
--    long names to clear the pipeline's 0.7 fuzzy acceptance threshold.
--    The score is computed ONCE per row in an inner subquery; the window
--    ranks over the column (repeating the expression in the window ORDER BY
--    would make Postgres evaluate it twice per row).
--
-- The existing fuzzy_match_ingredients / *_by_source functions are left
-- untouched (still used by the legacy v1 orchestrator path).
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.match_ingredients_all_sources(
  query_embedding vector(768),
  per_source_count int DEFAULT 3,
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
  SELECT t.id, t.name_primary, t.name_alt, t.name_en, t.state, t.source_id,
         t.score AS similarity
  FROM (
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
      vfc.source_id,
      (1 - (vfc.embedding <=> query_embedding))::float AS score,
      row_number() OVER (
        PARTITION BY vfc.source_id
        ORDER BY vfc.embedding <=> query_embedding
      ) AS rn
    FROM public.vietnamese_food_composition vfc
    WHERE vfc.embedding IS NOT NULL
  ) t
  WHERE t.rn <= per_source_count AND t.score >= match_threshold
  ORDER BY t.score DESC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.fuzzy_match_ingredients_all_sources(
  query_text text,
  per_source_count int DEFAULT 3,
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
    SELECT r.id, r.name_primary, r.name_alt, r.name_en, r.state, r.source_id,
           r.score AS similarity
    FROM (
      SELECT s.*, row_number() OVER (
        PARTITION BY s.source_id
        ORDER BY s.score DESC, length(s.name_primary) ASC
      ) AS rn
      FROM (
        SELECT
          vfc.id,
          vfc.name_primary,
          vfc.name_alt,
          vfc.name_en,
          vfc.state,
          vfc.source_id,
          GREATEST(
            extensions.word_similarity(query_text, vfc.name_primary),
            COALESCE(
              (SELECT MAX(extensions.word_similarity(query_text, alt))
               FROM unnest(vfc.name_alt) AS alt),
              0
            ),
            extensions.word_similarity(query_text, COALESCE(vfc.name_en, ''))
          )::float AS score
        FROM public.vietnamese_food_composition vfc
        WHERE extensions.word_similarity(query_text, vfc.search_text) >= match_threshold
      ) s
    ) r
    WHERE r.rn <= per_source_count
    ORDER BY r.score DESC;
  ELSE
    RETURN QUERY
    SELECT r.id, r.name_primary, r.name_alt, r.name_en, r.state, r.source_id,
           r.score AS similarity
    FROM (
      SELECT s.*, row_number() OVER (
        PARTITION BY s.source_id
        ORDER BY s.score DESC, length(s.name_primary) ASC
      ) AS rn
      FROM (
        SELECT
          vfc.id,
          vfc.name_primary,
          vfc.name_alt,
          vfc.name_en,
          vfc.state,
          vfc.source_id,
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
          )::float AS score
        FROM public.vietnamese_food_composition vfc
        WHERE extensions.word_similarity(normalized_query, vfc.search_text_ascii) >= match_threshold
      ) s
    ) r
    WHERE r.rn <= per_source_count
    ORDER BY r.score DESC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
