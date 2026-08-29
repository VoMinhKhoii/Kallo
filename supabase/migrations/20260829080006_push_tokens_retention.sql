-- =============================================================================
-- Domain B: Database Security & Logic — push_tokens idle retention
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- A registration token stops being refreshed the moment the app is deleted or
-- the device is retired, and FCM only reports UNREGISTERED when we actually
-- try to send — so a cold row would sit there forever costing one wasted HTTP
-- request per notification. Nine months of silence is well past any plausible
-- "phone in a drawer" gap while staying far outside FCM's own token-rotation
-- cadence, so a live device is never reaped out from under an active user; if
-- one is, the next app open re-registers it.
--
-- Appended as its own migration rather than edited into
-- 20260828122646_notifications_retention.sql — the ledger is append-only.
-- =============================================================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.reap_stale_push_tokens()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.push_tokens
  WHERE last_seen_at < (now() - interval '270 days');
$$;

REVOKE ALL ON FUNCTION public.reap_stale_push_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_stale_push_tokens() TO service_role;

-- Schedule via pg_cron if available; otherwise call from a daily worker.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'reap-stale-push-tokens-daily',
      '47 3 * * *',
      $cron$SELECT public.reap_stale_push_tokens();$cron$
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
