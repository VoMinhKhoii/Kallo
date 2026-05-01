-- pipeline_shadow_runs is system regression infrastructure.
-- Service role only. Never read by the user-facing app.
BEGIN;

ALTER TABLE public.pipeline_shadow_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_shadow_runs FROM authenticated, anon;
GRANT SELECT, INSERT ON public.pipeline_shadow_runs TO service_role;

CREATE INDEX IF NOT EXISTS idx_pipeline_shadow_runs_created_at
  ON public.pipeline_shadow_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_shadow_runs_request_id
  ON public.pipeline_shadow_runs (request_id);

COMMIT;
