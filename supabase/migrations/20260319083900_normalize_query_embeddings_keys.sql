SET search_path TO public, extensions;

-- Normalize existing name_vi primary keys to lowercase + trimmed + NFC form.
-- This ensures consistency with the app-layer normalizeIngredientKey() function.
--
-- Collision resolution: when two rows map to the same lowercased name_vi,
-- keep the row with name_en populated (more complete), tie-break by earliest created_at.

-- Step 1: Delete non-winner rows in collision groups
WITH normalized AS (
  SELECT
    name_vi,
    normalize(lower(trim(name_vi)), NFC) AS norm_key,
    ROW_NUMBER() OVER (
      PARTITION BY normalize(lower(trim(name_vi)), NFC)
      ORDER BY
        (name_en IS NOT NULL) DESC,
        created_at ASC
    ) AS rn
  FROM ingredient_query_embeddings
)
DELETE FROM ingredient_query_embeddings
WHERE name_vi IN (SELECT name_vi FROM normalized WHERE rn > 1);

-- Step 2: Update remaining rows to normalized form
UPDATE ingredient_query_embeddings
SET name_vi = normalize(lower(trim(name_vi)), NFC)
WHERE name_vi IS DISTINCT FROM normalize(lower(trim(name_vi)), NFC);
