-- Indexes for admin dashboard list/filter/sort.
-- - created_at DESC: default sort + date-range filters
-- - status, created_at: status filter combined with recency
-- - user_id, created_at: per-user request lookups
-- - replay_of_request_id: replay exclusion + replay-of joins
SET search_path TO public, extensions;

CREATE INDEX IF NOT EXISTS pipeline_requests_created_at_idx
  ON public.pipeline_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS pipeline_requests_status_created_at_idx
  ON public.pipeline_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS pipeline_requests_user_id_created_at_idx
  ON public.pipeline_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pipeline_requests_replay_of_request_id_idx
  ON public.pipeline_requests (replay_of_request_id)
  WHERE replay_of_request_id IS NOT NULL;
