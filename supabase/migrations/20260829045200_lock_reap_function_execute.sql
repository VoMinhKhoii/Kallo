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
-- FUNCTIONS. This closes the three known holes explicitly and stops future
-- functions from being born anon-callable.
--
-- The default-privileges change affects only functions created AFTER this
-- migration by the postgres role — existing, intentionally exposed RPCs
-- (search_public_profile, is_accepted_friend, is_active_coach_of) keep their
-- grants untouched. Functions created by supabase_admin (dashboard-side) keep
-- that role's default ACL; repo-owned functions all arrive via migrations as
-- postgres. pg_cron jobs are unaffected: they run as their scheduling role
-- (postgres), which retains owner EXECUTE.
-- =============================================================================

SET search_path TO public, extensions;

REVOKE ALL ON FUNCTION public.reap_old_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reap_stale_push_tokens() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reap_pipeline_requests() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.reap_old_notifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reap_stale_push_tokens() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reap_pipeline_requests() FROM anon, authenticated;

-- Future functions created by the migration role no longer default to
-- anon/authenticated EXECUTE; intentional RPCs must grant explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
