SET search_path TO public, extensions;

-- Replace the canonical-name bonus with the measured R4 lexical ranking.
--
-- This intentionally reverses 20260613063500_fuzzy_search_canonical_tiebreak.sql.
-- The +0.001 * primary_similarity bonus in that migration favours matches in
-- name_primary, but 93% of the rows are USDA rows whose name_primary is, on
-- average, a 64-character lab description. The human-usable name usually lives
-- in name_alt. In the 519-query blind double-judged bake-off, ranking by the
-- best-matching field and then by that matched field's length was the lexical
-- winner; fused with the existing vector arm as R7, it raised top-1 accuracy
-- from 50.48% to 56.84% and lowered disasters from 24.28% to 21.00%.
--
-- After applying, sanity-check the production data with:
--
--   SELECT id, name_primary, similarity
--   FROM public.fuzzy_match_ingredients_all_sources('ức gà', 3, 0.15);
--
-- usda_7209_raw ("Ức gà Oscar Mayer (phủ mật ong)") must not rank first.
-- The measured R4 lexical arm instead puts rating-2 usda_5117_raw first and
-- keeps a "phần ức" row (usda_5061_cooked) in its top three; after the
-- existing vector arm is fused, measured R7 ranks usda_5057_raw first and
-- usda_5062_raw third.
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
    WITH scored AS (
      SELECT
        vfc.id,
        vfc.name_primary,
        vfc.name_alt,
        vfc.name_en,
        vfc.state,
        vfc.source_id,
        extensions.word_similarity(
          query_text,
          vfc.name_primary
        ) AS primary_similarity,
        extensions.word_similarity(
          query_text,
          COALESCE(vfc.name_en, '')
        ) AS english_similarity,
        alias_match.similarity AS alias_similarity,
        alias_match.field_length AS alias_length
      FROM public.vietnamese_food_composition vfc
      LEFT JOIN LATERAL (
        SELECT
          extensions.word_similarity(query_text, alt) AS similarity,
          char_length(alt) AS field_length
        FROM unnest(vfc.name_alt) AS alt
        ORDER BY similarity DESC, field_length ASC, alt ASC
        LIMIT 1
      ) alias_match ON true
      WHERE extensions.word_similarity(query_text, vfc.search_text) >= match_threshold
    ), prepared AS (
      SELECT
        scored.*,
        GREATEST(
          scored.primary_similarity,
          scored.english_similarity,
          COALESCE(scored.alias_similarity, 0)
        ) AS best_similarity,
        LEAST(
          CASE
            WHEN scored.primary_similarity = GREATEST(
              scored.primary_similarity,
              scored.english_similarity,
              COALESCE(scored.alias_similarity, 0)
            ) THEN char_length(scored.name_primary)
            ELSE 2147483647
          END,
          CASE
            WHEN scored.english_similarity = GREATEST(
              scored.primary_similarity,
              scored.english_similarity,
              COALESCE(scored.alias_similarity, 0)
            ) THEN COALESCE(char_length(scored.name_en), 2147483647)
            ELSE 2147483647
          END,
          CASE
            WHEN COALESCE(scored.alias_similarity, 0) = GREATEST(
              scored.primary_similarity,
              scored.english_similarity,
              COALESCE(scored.alias_similarity, 0)
            ) THEN COALESCE(scored.alias_length, 2147483647)
            ELSE 2147483647
          END
        ) AS best_field_length
      FROM scored
    ), ranked AS (
      SELECT
        prepared.*,
        row_number() OVER (
          PARTITION BY prepared.source_id
          ORDER BY
            prepared.best_similarity DESC,
            prepared.best_field_length ASC,
            prepared.id ASC
        ) AS source_rank
      FROM prepared
    )
    SELECT
      ranked.id,
      ranked.name_primary,
      ranked.name_alt,
      ranked.name_en,
      ranked.state,
      ranked.source_id,
      ranked.best_similarity::float AS similarity
    FROM ranked
    WHERE ranked.source_rank <= per_source_count
    ORDER BY
      ranked.best_similarity DESC,
      ranked.best_field_length ASC,
      ranked.id ASC;
  ELSE
    RETURN QUERY
    WITH scored AS (
      SELECT
        vfc.id,
        vfc.name_primary,
        vfc.name_alt,
        vfc.name_en,
        vfc.state,
        vfc.source_id,
        extensions.word_similarity(
          normalized_query,
          lower(extensions.unaccent(vfc.name_primary))
        ) AS primary_similarity,
        extensions.word_similarity(
          normalized_query,
          lower(COALESCE(vfc.name_en, ''))
        ) AS english_similarity,
        alias_match.similarity AS alias_similarity,
        alias_match.field_length AS alias_length
      FROM public.vietnamese_food_composition vfc
      LEFT JOIN LATERAL (
        SELECT
          extensions.word_similarity(
            normalized_query,
            lower(extensions.unaccent(alt))
          ) AS similarity,
          char_length(alt) AS field_length
        FROM unnest(vfc.name_alt) AS alt
        ORDER BY similarity DESC, field_length ASC, alt ASC
        LIMIT 1
      ) alias_match ON true
      WHERE extensions.word_similarity(
        normalized_query,
        vfc.search_text_ascii
      ) >= match_threshold
    ), prepared AS (
      SELECT
        scored.*,
        GREATEST(
          scored.primary_similarity,
          scored.english_similarity,
          COALESCE(scored.alias_similarity, 0)
        ) AS best_similarity,
        LEAST(
          CASE
            WHEN scored.primary_similarity = GREATEST(
              scored.primary_similarity,
              scored.english_similarity,
              COALESCE(scored.alias_similarity, 0)
            ) THEN char_length(scored.name_primary)
            ELSE 2147483647
          END,
          CASE
            WHEN scored.english_similarity = GREATEST(
              scored.primary_similarity,
              scored.english_similarity,
              COALESCE(scored.alias_similarity, 0)
            ) THEN COALESCE(char_length(scored.name_en), 2147483647)
            ELSE 2147483647
          END,
          CASE
            WHEN COALESCE(scored.alias_similarity, 0) = GREATEST(
              scored.primary_similarity,
              scored.english_similarity,
              COALESCE(scored.alias_similarity, 0)
            ) THEN COALESCE(scored.alias_length, 2147483647)
            ELSE 2147483647
          END
        ) AS best_field_length
      FROM scored
    ), ranked AS (
      SELECT
        prepared.*,
        row_number() OVER (
          PARTITION BY prepared.source_id
          ORDER BY
            prepared.best_similarity DESC,
            prepared.best_field_length ASC,
            prepared.id ASC
        ) AS source_rank
      FROM prepared
    )
    SELECT
      ranked.id,
      ranked.name_primary,
      ranked.name_alt,
      ranked.name_en,
      ranked.state,
      ranked.source_id,
      ranked.best_similarity::float AS similarity
    FROM ranked
    WHERE ranked.source_rank <= per_source_count
    ORDER BY
      ranked.best_similarity DESC,
      ranked.best_field_length ASC,
      ranked.id ASC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
