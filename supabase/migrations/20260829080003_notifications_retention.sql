-- =============================================================================
-- Domain B: Database Security & Logic — notifications 90-day retention
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- The activity feed is an ambient surface, not an archive: nothing reads a
-- notification older than the "Older" bucket, and the domain rows it points at
-- (invites, shares, friendships) remain the durable record. Ninety days keeps
-- the table bounded without ever truncating a live aggregate — an open row is
-- re-created with created_at = now() on every refresh, so only genuinely cold
-- activity ages out.
-- =============================================================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.reap_old_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.notifications
  WHERE created_at < (now() - interval '90 days');
$$;

REVOKE ALL ON FUNCTION public.reap_old_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_old_notifications() TO service_role;

-- Schedule via pg_cron if available; otherwise call from a daily worker.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'reap-old-notifications-daily',
      '41 3 * * *',
      $cron$SELECT public.reap_old_notifications();$cron$
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
