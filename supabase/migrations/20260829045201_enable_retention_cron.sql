-- =============================================================================
-- Domain B: Database Security & Logic — install pg_cron and schedule retention
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Production audit finding: pg_cron was never installed on the project, so the
-- guarded `cron.schedule` blocks in 20260430201543 (pipeline requests, 7d),
-- 20260828122646 (notifications, 90d) and 20260828131957 (push tokens, 270d)
-- all silently no-op'd — every documented retention policy was inert.
--
-- DELIBERATELY FAIL-LOUD, unlike those earlier guarded blocks: swallowing the
-- failure here would commit this migration to the ledger while scheduling
-- nothing — recreating the exact silent-no-op condition being remediated, with
-- no replay path short of a new migration. Supabase's hosted and local images
-- both ship pg_cron, and SQL installation is supported; if this environment
-- truly cannot install or schedule, the push must fail visibly so the operator
-- resolves it (Dashboard → Extensions) and re-pushes.
-- =============================================================================

SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  job record;
BEGIN
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
END $$;

-- Assert the remediation actually took: three named jobs, present and exact.
DO $$
BEGIN
  IF (
    SELECT count(*) FROM cron.job
    WHERE jobname IN (
      'reap-pipeline-requests-daily',
      'reap-old-notifications-daily',
      'reap-stale-push-tokens-daily'
    )
  ) <> 3 THEN
    RAISE EXCEPTION 'retention cron jobs were not all scheduled';
  END IF;
END $$;
