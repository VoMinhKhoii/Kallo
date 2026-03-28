SET search_path TO public, extensions;

-- Seed ingredient_query_embeddings from the FAO VTN FCT 2007 table.
-- Each row stores both Vietnamese (name_vi) and English (name_en) names
-- with the shared embedding vector from the food composition table.

INSERT INTO ingredient_query_embeddings (name_vi, name_en, embedding)
SELECT name_primary, name_en, embedding
FROM vietnamese_food_composition
WHERE embedding IS NOT NULL
ON CONFLICT (name_vi) DO NOTHING;
