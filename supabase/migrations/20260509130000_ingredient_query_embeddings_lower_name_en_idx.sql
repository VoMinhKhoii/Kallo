-- Functional index on lower(name_en) so the L2 cache lookup
--   WHERE name_vi = $1 OR lower(name_en) = $1
-- can use an index on each branch instead of falling back to a sequential
-- scan. The existing idx_qe_name_en (btree on name_en) cannot satisfy the
-- lower() expression, which is what reintroduces the per-English-ingredient
-- ~600 ms cliff Phase C4 was meant to remove.
CREATE INDEX IF NOT EXISTS idx_qe_name_en_lower
  ON ingredient_query_embeddings (lower(name_en));
