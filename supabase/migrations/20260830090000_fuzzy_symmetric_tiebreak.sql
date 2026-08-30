-- Fuzzy-arm tie-break: symmetric trigram similarity before field length.
--
-- Problem: the arm's primary score is word_similarity(query, field), which
-- saturates at 1.0 whenever the query appears as a contiguous extent of the
-- field — for "chicken breast", EIGHT processed rows tie at 1.0 ("Chicken
-- breast, roll, oven-roasted", breaded tenders, deli slices…). The old
-- secondary key (matched-field char length) then effectively crowned the
-- shortest processed name, and RRF's arm-agreement heuristic carried it to
-- the top of the fused candidate list ("150g grilled chicken breast" scored
-- against a 14.6 g-protein deli roll).
--
-- Fix: insert SYMMETRIC trigram similarity (extensions.similarity) as the
-- secondary key. It penalizes tokens the query never asked for ("roll,
-- oven-roasted" lowers the score; "raw" barely does), so among word_similarity
-- ties the least-adorned genuine row ranks first. Field length stays as the
-- tertiary key, id as the final deterministic tie-break.
--
-- Signature and row shape are unchanged; only ORDER BY semantics move.

CREATE OR REPLACE FUNCTION public.fuzzy_match_ingredients_all_sources(
  query_text text,
  per_source_count integer DEFAULT 3,
  match_threshold double precision DEFAULT 0.15
)
RETURNS TABLE(
  id text,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  source_id integer,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
AS $function$
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
        GREATEST(
          extensions.similarity(vfc.name_primary, query_text),
          extensions.similarity(COALESCE(vfc.name_en, ''), query_text),
          COALESCE(alias_match.symmetric_similarity, 0)
        ) AS symmetric_similarity,
        alias_match.similarity AS alias_similarity,
        alias_match.field_length AS alias_length
      FROM public.vietnamese_food_composition vfc
      LEFT JOIN LATERAL (
        SELECT
          extensions.word_similarity(query_text, alt) AS similarity,
          extensions.similarity(alt, query_text) AS symmetric_similarity,
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
            prepared.symmetric_similarity DESC,
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
      ranked.symmetric_similarity DESC,
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
        GREATEST(
          extensions.similarity(
            lower(extensions.unaccent(vfc.name_primary)),
            normalized_query
          ),
          extensions.similarity(lower(COALESCE(vfc.name_en, '')), normalized_query),
          COALESCE(alias_match.symmetric_similarity, 0)
        ) AS symmetric_similarity,
        alias_match.similarity AS alias_similarity,
        alias_match.field_length AS alias_length
      FROM public.vietnamese_food_composition vfc
      LEFT JOIN LATERAL (
        SELECT
          extensions.word_similarity(
            normalized_query,
            lower(extensions.unaccent(alt))
          ) AS similarity,
          extensions.similarity(
            lower(extensions.unaccent(alt)),
            normalized_query
          ) AS symmetric_similarity,
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
            prepared.symmetric_similarity DESC,
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
      ranked.symmetric_similarity DESC,
      ranked.best_field_length ASC,
      ranked.id ASC;
  END IF;
END;
$function$;
