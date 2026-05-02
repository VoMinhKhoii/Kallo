-- Decision A — split debug-from-analytics retention.
-- pipeline_requests is short-window operational debug only.
-- pipeline_runs is the analytics source.
SET search_path TO public, extensions;

-- Tighten RLS: drop any user-facing policies; service role only.
ALTER TABLE public.pipeline_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.pipeline_requests'::regclass
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.pipeline_requests',
      pol.polname
    );
  END LOOP;
END $$;

-- 7-day TTL retention. Use a cron extension if available; otherwise this
-- migration documents the policy and supplies a manual reaper function.
CREATE OR REPLACE FUNCTION public.reap_pipeline_requests()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.pipeline_requests
  WHERE created_at < (now() - interval '7 days');
$$;

REVOKE ALL ON FUNCTION public.reap_pipeline_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_pipeline_requests() TO service_role;

-- Schedule via pg_cron if available; otherwise call from a daily worker.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'reap-pipeline-requests-daily',
      '17 3 * * *',
      $cron$SELECT public.reap_pipeline_requests();$cron$
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    -- pg_cron exists but cron schema not granted to this role, or
    -- cron.schedule signature differs. Daily reap must be invoked
    -- externally. Any other exception class re-raises so we don't
    -- silently swallow real schema errors.
    NULL;
END $$;
