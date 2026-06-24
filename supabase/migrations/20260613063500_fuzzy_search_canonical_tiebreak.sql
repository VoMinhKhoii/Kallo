-- Fix: fuzzy_match_ingredients_all_sources saturates at similarity = 1.0.
--
-- word_similarity(query, X) returns 1.0 whenever the query appears as a
-- contiguous extent in X — including in ANY name_alt variant. The USDA
-- translation generated "ức gà"-prefixed variants very liberally (turkey
-- "ức gà tây", pheasant "ức gà lôi", grilled-lean "ức gà nướng", ...), so for
-- a query like "ức gà" dozens of poultry rows all score exactly 1.0. With the
-- ranking saturated, the per-source window's tie-break — length(name_primary)
-- ASC — decided the order, surfacing the SHORTEST names ("Gà nướng, thịt nạc")
-- and burying the canonical chicken-breast entries (long descriptive names
-- like "Thịt ức gà (gà công nghiệp...), bỏ da, bỏ xương...").
--
-- Fix: add a tiny ADDITIVE tie-break that rewards rows matching the canonical
-- name_primary (where Vietnamese word order places "ức gà" contiguously for
-- chicken breast — "Thịt ức gà ..." — but NOT for "Gà nướng, thịt nạc" whose
-- "ức gà" lives only in an LLM-generated alt). The term is +0.001 * the
-- name_primary word-similarity, so:
--   * it only ever RAISES the score → gating thresholds (manual route's 0.85,
--     the pipeline's 0.7/0.8) are never tightened, so no match is newly
--     dropped (safe for the shared AI-matcher path);
--   * it de-saturates the 1.0 ties: a row with "ức gà" in name_primary
--     (score ~1.001) now sorts above a row matching only via name_alt
--     (score ~1.0004), in both the per-source window and the final order.
--
-- Note: this cannot separate chicken breast from "ức gà tây" (turkey breast),
-- which also has "ức gà" contiguous in its primary name — lexical search has
-- no species knowledge. The embedding arm in the search route handles that
-- semantic disambiguation; this fix gets the breast entries to the top and
-- drops the non-breast (grilled/stewed/lean) noise.
SET search_path TO public, extensions;

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
          (GREATEST(
            extensions.word_similarity(query_text, vfc.name_primary),
            COALESCE(
              (SELECT MAX(extensions.word_similarity(query_text, alt))
               FROM unnest(vfc.name_alt) AS alt),
              0
            ),
            extensions.word_similarity(query_text, COALESCE(vfc.name_en, ''))
          )
          -- Canonical-name tie-break (de-saturates the 1.0 word_similarity
          -- ties; additive so gating is never tightened).
          + 0.001 * extensions.word_similarity(query_text, vfc.name_primary)
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
          (GREATEST(
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
          )
          + 0.001 * extensions.word_similarity(
              normalized_query, lower(extensions.unaccent(vfc.name_primary))
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
