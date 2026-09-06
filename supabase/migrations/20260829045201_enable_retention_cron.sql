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
-- nothing — recreating the exact silent-no-op condition being remediated.
-- Supabase's hosted and local images both ship pg_cron; if this environment
-- truly cannot install or schedule, the push must fail visibly.
--
-- The two notification reapers are created by the notification feature branch,
-- which may merge after this migration: their jobs are scheduled only when the
-- function exists (a job for an absent function would fail every night), and
-- the closing assertion demands exactly one job per existing function. Once
-- the feature's earlier-timestamped migrations are present, any fresh replay
-- creates the functions first and this migration schedules all three.
-- =============================================================================

SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  entry record;
  expected int := 0;
  actual int;
BEGIN
  -- Loop variable deliberately NOT named "job": inside these queries plpgsql
  -- would make `job.jobname` ambiguous against the cron.job table itself.
  FOR entry IN
    SELECT * FROM (VALUES
      ('reap-pipeline-requests-daily', '17 3 * * *', 'public.reap_pipeline_requests()'),
      ('reap-old-notifications-daily', '41 3 * * *', 'public.reap_old_notifications()'),
      ('reap-stale-push-tokens-daily', '47 3 * * *', 'public.reap_stale_push_tokens()')
    ) AS t(jobname, schedule, fn)
  LOOP
    IF to_regprocedure(entry.fn) IS NULL THEN
      CONTINUE;
    END IF;
    expected := expected + 1;
    IF EXISTS (SELECT 1 FROM cron.job c WHERE c.jobname = entry.jobname) THEN
      PERFORM cron.unschedule(entry.jobname);
    END IF;
    PERFORM cron.schedule(entry.jobname, entry.schedule, 'SELECT ' || entry.fn || ';');
  END LOOP;

  -- Assert the remediation actually took: one job per existing reap function.
  SELECT count(*) INTO actual FROM cron.job
  WHERE jobname IN (
    'reap-pipeline-requests-daily',
    'reap-old-notifications-daily',
    'reap-stale-push-tokens-daily'
  );
  IF actual <> expected OR expected = 0 THEN
    RAISE EXCEPTION
      'retention cron jobs not scheduled (expected %, found %)', expected, actual;
  END IF;
END $$;
