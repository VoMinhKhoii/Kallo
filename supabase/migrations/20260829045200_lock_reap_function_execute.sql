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
-- FUNCTIONS. This closes the three known holes explicitly.
--
-- Deliberately NOT a blanket `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON
-- FUNCTIONS`: RLS policies and intentionally exposed RPCs
-- (search_public_profile, is_accepted_friend, is_active_coach_of) rely on
-- authenticated EXECUTE. A full function-surface audit is a follow-up.
-- =============================================================================

SET search_path TO public, extensions;

REVOKE EXECUTE ON FUNCTION public.reap_old_notifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reap_stale_push_tokens() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reap_pipeline_requests() FROM anon, authenticated;
