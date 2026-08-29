-- =============================================================================
-- Domain B: Database Security & Logic — lock RPC EXECUTE on reap functions
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Production audit finding: `REVOKE ALL ... FROM PUBLIC` on the reap functions
-- did not remove the EXPLICIT anon/authenticated EXECUTE grants that Supabase's
-- default privileges attach to every new public function, so all three
-- SECURITY DEFINER reapers were callable through PostgREST with the publishable
-- anon key (`POST /rest/v1/rpc/reap_old_notifications` → mass delete on
-- demand). The 20260825120000 lockdown revoked TABLES and SEQUENCES but not
-- FUNCTIONS. This closes the known holes explicitly and stops future functions
-- from being born anon-callable.
--
-- The notification reapers are created by the notification feature branch,
-- which may merge after this migration: each revoke is existence-guarded so a
-- main-only replay skips absent functions. Ordering converges either way —
-- those migrations carry earlier timestamps, so any fresh replay that has the
-- files creates the functions first and this revoke strips them.
--
-- The default-privileges changes affect only functions created AFTER this
-- migration by the postgres role — existing, intentionally exposed RPCs
-- (search_public_profile, is_accepted_friend, is_active_coach_of) keep their
-- grants untouched. pg_cron jobs are unaffected: they run as their scheduling
-- role (postgres), which retains owner EXECUTE.
-- =============================================================================

SET search_path TO public, extensions;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.reap_pipeline_requests()',
    'public.reap_old_notifications()',
    'public.reap_stale_push_tokens()'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', fn);
    END IF;
  END LOOP;
END $$;

-- Future functions created by the migration role no longer default to
-- anon/authenticated EXECUTE; intentional RPCs must grant explicitly.
-- Both revokes are needed: the schema-scoped one strips Supabase's explicit
-- anon/authenticated defaults, and the global one overrides PostgreSQL's
-- built-in PUBLIC EXECUTE default, which a schema-scoped revoke cannot remove.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
