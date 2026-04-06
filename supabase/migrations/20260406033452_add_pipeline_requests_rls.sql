-- RLS for pipeline_requests table
ALTER TABLE pipeline_requests ENABLE ROW LEVEL SECURITY;

-- Only the owning user can read their own pipeline requests
CREATE POLICY "pipeline_requests_select_own"
  ON pipeline_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Writes happen through Drizzle + postgres.js (direct DB connection with
-- privileged role), not through the Supabase JS client. No user-level
-- INSERT/UPDATE/DELETE policies are needed — the privileged role bypasses RLS.
