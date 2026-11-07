-- =============================================================================
-- Domain B: Database Security & Logic — meal_reminders retention
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- The reminder tick only ever reads today's and yesterday's rows (what was
-- already decided, and how many in a row went unanswered). Two weeks keeps
-- enough history to debug a "why did I get this?" report and caps the table
-- at ~56 rows per user. Same guarded pg_cron block as the push_tokens reap.
-- =============================================================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.reap_old_meal_reminders()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.meal_reminders
  WHERE local_date < (current_date - 14);
$$;

REVOKE ALL ON FUNCTION public.reap_old_meal_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_old_meal_reminders() TO service_role;

-- Schedule via pg_cron if available; otherwise call from a daily worker.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'reap-old-meal-reminders-daily',
      '53 3 * * *',
      $cron$SELECT public.reap_old_meal_reminders();$cron$
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    -- pg_cron exists but the cron schema is not granted to this role, or
    -- cron.schedule's signature differs: the reap must then be invoked
    -- externally. Any other exception class re-raises.
    NULL;
END $$;
