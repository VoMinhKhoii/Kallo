-- =============================================================================
-- Domain B: Database Security & Logic — install pg_cron and schedule retention
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Production audit finding: pg_cron was never installed on the project, so the
-- guarded `cron.schedule` blocks in 20260430201543 (pipeline requests, 7d),
-- 20260828122646 (notifications, 90d) and 20260828131957 (push tokens, 270d)
-- all silently no-op'd — every documented retention policy was inert. This
-- installs the extension (Supabase exposes it to the postgres role) and
-- re-runs the three schedules idempotently (unschedule-if-present first).
-- If the CREATE EXTENSION is not permitted in this environment the DO block
-- swallows only privilege errors and the schedules keep no-op'ing — same
-- behavior as before, revisit via the dashboard's Extensions page.
-- =============================================================================

SET search_path TO public, extensions;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;

DO $$
DECLARE
  job record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR job IN
      SELECT * FROM (VALUES
        ('reap-pipeline-requests-daily', '17 3 * * *', 'SELECT public.reap_pipeline_requests();'),
        ('reap-old-notifications-daily', '41 3 * * *', 'SELECT public.reap_old_notifications();'),
        ('reap-stale-push-tokens-daily', '47 3 * * *', 'SELECT public.reap_stale_push_tokens();')
      ) AS t(jobname, schedule, command)
    LOOP
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job.jobname) THEN
        PERFORM cron.unschedule(job.jobname);
      END IF;
      PERFORM cron.schedule(job.jobname, job.schedule, job.command);
    END LOOP;
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    -- pg_cron present but cron schema not granted to this role. Retention
    -- must then be invoked externally; any other exception re-raises.
    NULL;
END $$;
