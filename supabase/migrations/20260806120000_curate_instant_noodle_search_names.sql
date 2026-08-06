-- Make instant noodles (mì gói / mì ăn liền) reachable by the matcher.
--
-- These USDA SR Legacy rows have been in the table all along, but the
-- Vietnamese translation pass (scripts/translate-usda-vietnamese) skipped
-- them: `name_primary` is still the raw English string and `name_alt` is
-- NULL. Since `fuzzy_match_ingredients_all_sources` scores against
-- name_primary / name_alt / name_en, a Vietnamese query could never reach
-- them. Measured on the dev DB before this migration:
--
--   'mì gói'      → best hit 0.572  "Mì gạo khô" (dry RICE noodles)   → dropped at the 0.70 floor
--   'mì tôm'      → best hit 0.572  "Tôm biển" (sea shrimp)           → dropped
--   'mì ăn liền'  → best hit 0.728  "Gạo trắng ... ăn liền" (instant RICE) → ACCEPTED, and wrong
--
-- So the reported symptom ("mì gói got zero candidates") and its uglier
-- sibling (mì ăn liền silently matching instant rice) are both this one gap.
--
-- Same shape as 20260801120000_curate_broth_search_names.sql: renaming lets
-- the trigger rebuild search_text/search_text_ascii, and clearing `embedding`
-- queues the rows for the gemini-embedding-001 backfill that runs after
-- migrations in the production deploy workflow.
--
-- Fresh CI resets seed only the 526 FAO rows; the USDA reference rows are
-- imported separately, so this migration must be a no-op when they are absent.
--
-- NAME DESIGN (verified with extensions.word_similarity on the dev DB — these
-- names are load-bearing, not cosmetic):
--   * "mì gói" and "mì ăn liền" appear CONTIGUOUSLY in every name_primary, so
--     word_similarity returns 1.0 for both queries.
--   * The generic row's name_primary is deliberately the SHORTEST. All four
--     rows tie at 1.0 for a bare "mì gói", and the per-source window breaks
--     ties on length(name_primary) ASC — so "any flavor" outranks the beef,
--     chicken, and reduced-fat variants, which is the right default.
--   * `mì tôm` is deliberately NOT an alias here. word_similarity('tôm',
--     'mì tôm') = 1.0, so it would make EVERY shrimp query match instant
--     noodles at a perfect score. It lives in PRE_MATCH_ALIASES instead
--     (lib/ai/matching/aliases.ts) — an exact normalized-key rewrite with no
--     fuzzy blast radius. `mì ly` is omitted for the same reason ('ly' → 1.0).
--   * `mì bò` and `mì gà` are omitted from the flavor rows for that same
--     reason — a bare 'bò' or 'gà' query would score 1.0 against dry instant
--     noodles and hijack ordinary beef/chicken matches. They are NOT added to
--     PRE_MATCH_ALIASES either: unlike 'mì tôm', a bare "mì bò"/"mì gà" much
--     more often means a beef/chicken NOODLE SOUP than an instant packet, so
--     an exact rewrite would be wrong more often than right. The flavor rows
--     stay reachable through 'mì gói vị bò' / 'mì ăn liền vị gà' and through
--     the generic 'mì gói' tie-break.
--   * Collateral checked and clear at the 0.70 floor: bánh mì 0.375,
--     bột mì 0.429, mì xào 0.429, mì Quảng 0.333, mì trứng 0.333, miến 0.200,
--     tôm / tôm sú / tôm biển / ruốc tôm 0.000.
--
-- STATE: every row is `raw` and DRY-basis (~440 kcal/100g for the packet, not
-- for a prepared bowl). That pairs with the 80g dry-packet portion prior for
-- `gói` in lib/ai/portion/priors.ts. A prepared-bowl row is NOT invented here
-- — SR Legacy has no prepared ramen entry, and deriving one would be
-- fabrication. Call 2 receives db_state="raw" and scopes its grams to it,
-- the same contract that already carries raw rice.

SET search_path TO public, extensions;

UPDATE vietnamese_food_composition AS vfc
SET
  name_primary = curated.name_primary,
  name_alt = curated.name_alt,
  embedding = NULL
FROM (
  VALUES
    (
      'usda_6583_raw',
      'Mì ăn liền (mì gói), khô',
      ARRAY['mì gói', 'mì ăn liền', 'mì gói khô', 'mì ăn liền khô']::text[]
    ),
    (
      'usda_6982_raw',
      'Mì ăn liền (mì gói) vị bò, khô',
      ARRAY['mì gói vị bò', 'mì ăn liền vị bò']::text[]
    ),
    (
      'usda_6983_raw',
      'Mì ăn liền (mì gói) vị gà, khô',
      ARRAY['mì gói vị gà', 'mì ăn liền vị gà']::text[]
    ),
    (
      'usda_27035_raw',
      'Mì ăn liền (mì gói) giảm béo, giảm natri, khô',
      ARRAY['mì gói giảm béo', 'mì ăn liền ít béo', 'mì gói ít natri']::text[]
    )
) AS curated(id, name_primary, name_alt)
WHERE vfc.id = curated.id;
