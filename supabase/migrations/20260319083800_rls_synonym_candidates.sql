SET search_path TO public, extensions;

-- Enable RLS on synonym_candidates
ALTER TABLE synonym_candidates ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users (review dashboard)
CREATE POLICY "Authenticated users can read synonym candidates"
  ON synonym_candidates
  FOR SELECT
  TO authenticated
  USING (true);

-- Write access for authenticated users (cache-miss logging + background jobs)
CREATE POLICY "Authenticated users can insert synonym candidates"
  ON synonym_candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update access for authenticated users (mark as reviewed)
CREATE POLICY "Authenticated users can update synonym candidates"
  ON synonym_candidates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
