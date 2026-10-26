-- =============================================================================
-- Domain B: Database Security & Logic — retire the merged analysis guard's
-- reapers and the limiter's 7-argument consume.
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- The analysis guard was merged into the one rate limiter, and the generic
-- consume moved to the 11-argument `rate_limit_consume`. PUSH ONLY AFTER that
-- code is deployed: the revision before it still calls the 7-argument
-- function and writes the analysis-guard tables.
--
-- Runs before 20261025185310_drop_analysis_guard_tables so no cron job is
-- ever left pointing at a table that no longer exists.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  -- Not named `jobname`: plpgsql would make `c.jobname` ambiguous.
  v_job text;
BEGIN
  FOREACH v_job IN ARRAY ARRAY[
    'reap-analysis-rate-limit-windows-daily',
    'reap-analysis-in-flight-limits-daily',
    'reap-analysis_guard_events-daily'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job c WHERE c.jobname = v_job) THEN
      PERFORM cron.unschedule(v_job);
    END IF;
  END LOOP;

  -- Fail loud, like the migrations that scheduled them.
  IF EXISTS (
    SELECT 1 FROM cron.job c
    WHERE c.jobname IN (
      'reap-analysis-rate-limit-windows-daily',
      'reap-analysis-in-flight-limits-daily',
      'reap-analysis_guard_events-daily'
    )
  ) THEN
    RAISE EXCEPTION 'analysis guard reaper jobs are still scheduled';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.reap_analysis_rate_limit_windows();
DROP FUNCTION IF EXISTS public.reap_analysis_in_flight_limits();
DROP FUNCTION IF EXISTS public.reap_analysis_guard_events();

DROP FUNCTION IF EXISTS public.rate_limit_consume(
  text, text, text, integer, integer, integer, timestamptz
);
