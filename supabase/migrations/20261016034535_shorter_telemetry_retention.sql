-- Shorten telemetry retention to 61 days (owner, 2026-10-16: the admin
-- dashboard's longest window is now 30 days; 61 = that window + the prior
-- window its change badges compare against + 1). The spend cap reads only
-- today's budget rows. Guard events stay at 30 days.
-- Only the reaper cutoffs change; the pg_cron jobs from
-- 20261015183834_trace_retention_and_request_summaries.sql keep calling the
-- same functions on the same schedules.
SET search_path TO public, extensions;

DO $migration$
DECLARE
  policy record;
  fn text;
BEGIN
  FOR policy IN SELECT * FROM (VALUES
    ('analysis_model_budget_events', 61),
    ('pipeline_runs', 61),
    ('unmatched_ingredients', 61),
    ('synonym_candidates', 61),
    ('pipeline_request_replay_audit_logs', 61)
  ) AS p(table_name, days)
  LOOP
    fn := 'reap_' || policy.table_name;
    EXECUTE format($ddl$
      CREATE OR REPLACE FUNCTION public.%I()
      RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = pg_catalog, pg_temp
      AS $body$
      DECLARE
        affected integer;
        total integer := 0;
        cutoff timestamptz := now() - %L::interval;
      BEGIN
        -- At most 100k rows/run, 5k per statement. Locks remain until commit;
        -- a large initial backlog may need repeated manual invocations.
        FOR batch IN 1..20 LOOP
          DELETE FROM public.%I WHERE ctid IN (
            SELECT ctid FROM public.%I
            WHERE created_at < cutoff ORDER BY created_at LIMIT 5000
            FOR UPDATE SKIP LOCKED
          );
          GET DIAGNOSTICS affected = ROW_COUNT;
          total := total + affected;
          EXIT WHEN affected < 5000;
        END LOOP;
        RETURN total;
      END;
      $body$;
    $ddl$, fn, policy.days || ' days', policy.table_name, policy.table_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I() TO service_role', fn);
    IF NOT EXISTS (SELECT 1 FROM cron.job c
      WHERE c.jobname = 'reap-' || policy.table_name || '-daily' AND c.active) THEN
      RAISE EXCEPTION 'Retention job for % is not scheduled', policy.table_name;
    END IF;
  END LOOP;
END $migration$;
