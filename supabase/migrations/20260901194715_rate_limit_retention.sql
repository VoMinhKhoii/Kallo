-- =============================================================================
-- Domain B: Database Security & Logic — limiter retention (4 reapers + pg_cron)
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Four tables accumulate limiter state and none of them had a reaper:
--
--  * rate_limit_counters   — one row per (key, route). IP-keyed policies mint a
--    row per /64 prefix, so a botnet can mint them faster than any human
--    population; 2 days is well past the longest window (a day) plus slack.
--  * rate_limit_events     — the audit trail; 30 days is long enough to
--    reconstruct an incident and short enough to stay cheap.
--  * analysis_rate_limit_windows — the LEGACY analysis guard's per-window rows,
--    shipped in 20260506173558 with an `updated_at` index and no retention at
--    all. Same 2-day horizon, same reasoning.
--  * analysis_in_flight_limits   — the legacy concurrency slots. Reaped by AGE
--    ALONE, count > 0 included: a row still holding a slot a full day later is
--    a crash-abandoned lease, not live work (the live path is already covered
--    by the 90-second stale-reset in analysis-guard-counters.ts, and a day is
--    orders of magnitude past any request's wall clock).
--
-- BATCHING CAVEAT, stated honestly: reap_rate_limit_counters deletes in
-- 50k-row batches via a ctid subselect so no single DELETE statement has to
-- plan and lock the whole table. It is a FUNCTION, not a PROCEDURE, so it
-- cannot COMMIT between batches — the batching bounds each STATEMENT, not the
-- transaction. That is the right trade today (the table is small and the
-- statement-level bound is what keeps the nightly run off the hot path); if
-- the counter table ever grows past what one transaction should hold, the
-- follow-up is a PROCEDURE with COMMIT invoked via `CALL` from cron, not a
-- bigger batch.
-- =============================================================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.reap_rate_limit_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_deleted int;
BEGIN
  LOOP
    DELETE FROM public.rate_limit_counters t
    WHERE t.ctid IN (
      SELECT c.ctid
      FROM public.rate_limit_counters c
      WHERE c.updated_at < (now() - interval '2 days')
      LIMIT 50000
    );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    EXIT WHEN v_deleted = 0;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reap_rate_limit_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  DELETE FROM public.rate_limit_events t
  WHERE t.created_at < (now() - interval '30 days');
$$;

CREATE OR REPLACE FUNCTION public.reap_analysis_rate_limit_windows()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  DELETE FROM public.analysis_rate_limit_windows t
  WHERE t.updated_at < (now() - interval '2 days');
$$;

CREATE OR REPLACE FUNCTION public.reap_analysis_in_flight_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  DELETE FROM public.analysis_in_flight_limits t
  WHERE t.updated_at < (now() - interval '1 day');
$$;

-- Server-only, same lockdown 20260829045200 applied to the earlier reapers:
-- a SECURITY DEFINER mass-delete must never be reachable through PostgREST.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.reap_rate_limit_counters()',
    'public.reap_rate_limit_events()',
    'public.reap_analysis_rate_limit_windows()',
    'public.reap_analysis_in_flight_limits()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- DELIBERATELY FAIL-LOUD, like 20260829045201: a guarded block that swallows a
-- scheduling failure would commit this migration to the ledger while scheduling
-- nothing, recreating the silent-no-op condition that left every documented
-- retention policy inert for months.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  entry record;
  expected int := 0;
  actual int;
BEGIN
  -- Loop variable deliberately NOT named "job": plpgsql would make
  -- `job.jobname` ambiguous against the cron.job table itself.
  FOR entry IN
    SELECT * FROM (VALUES
      ('reap-rate-limit-counters-daily', '53 3 * * *',
        'public.reap_rate_limit_counters()'),
      ('reap-rate-limit-events-daily', '54 3 * * *',
        'public.reap_rate_limit_events()'),
      ('reap-analysis-rate-limit-windows-daily', '55 3 * * *',
        'public.reap_analysis_rate_limit_windows()'),
      ('reap-analysis-in-flight-limits-daily', '57 3 * * *',
        'public.reap_analysis_in_flight_limits()')
    ) AS t(jobname, schedule, fn)
  LOOP
    IF to_regprocedure(entry.fn) IS NULL THEN
      RAISE EXCEPTION 'reap function % is missing', entry.fn;
    END IF;
    expected := expected + 1;
    IF EXISTS (SELECT 1 FROM cron.job c WHERE c.jobname = entry.jobname) THEN
      PERFORM cron.unschedule(entry.jobname);
    END IF;
    PERFORM cron.schedule(
      entry.jobname, entry.schedule, 'SELECT ' || entry.fn || ';'
    );
  END LOOP;

  SELECT count(*) INTO actual FROM cron.job
  WHERE jobname IN (
    'reap-rate-limit-counters-daily',
    'reap-rate-limit-events-daily',
    'reap-analysis-rate-limit-windows-daily',
    'reap-analysis-in-flight-limits-daily'
  );
  IF actual <> 4 OR expected <> 4 THEN
    RAISE EXCEPTION
      'limiter retention cron jobs not scheduled (expected 4, found %)', actual;
  END IF;
END $$;
