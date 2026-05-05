-- pipeline_runs is system telemetry. Service role only.
SET search_path TO public, extensions;

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_runs FROM authenticated, anon;
GRANT SELECT, INSERT ON public.pipeline_runs TO service_role;

-- No policies for authenticated/anon = no access.
-- The service role bypasses RLS by design; that's the only writer/reader.

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at
  ON public.pipeline_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_id_hash_created_at
  ON public.pipeline_runs (user_id_hash, created_at DESC);
