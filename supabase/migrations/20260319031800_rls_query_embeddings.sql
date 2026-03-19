SET search_path TO public, extensions;

-- Enable RLS on the query embeddings cache table
ALTER TABLE ingredient_query_embeddings ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users (defense in depth;
-- the matching pipeline uses direct postgres connection which bypasses RLS)
CREATE POLICY "Authenticated users can read query embeddings"
  ON ingredient_query_embeddings
  FOR SELECT
  TO authenticated
  USING (true);

-- Write access for authenticated users (fire-and-forget cache inserts from matching pipeline)
CREATE POLICY "Authenticated users can insert query embeddings"
  ON ingredient_query_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- B-tree index on name_en for exact equality lookups
CREATE INDEX idx_qe_name_en ON ingredient_query_embeddings (name_en);

-- GIN indexes with pg_trgm for tiered similarity fallback
CREATE INDEX idx_qe_name_vi_trgm ON ingredient_query_embeddings USING gin (name_vi gin_trgm_ops);
CREATE INDEX idx_qe_name_en_trgm ON ingredient_query_embeddings USING gin (name_en gin_trgm_ops);
