-- =============================================================================
-- Domain B: Database Security & Logic — apple_auth_tokens server-only
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- One sealed Sign in with Apple refresh token per user, written by
-- POST /api/v1/auth/apple/token and read once by account deletion to revoke
-- it — both on the Drizzle owner connection with an explicit user_id
-- predicate. RLS is enabled with no client policies so PostgREST can never
-- read a credential, even sealed; the API-role grants are already withheld
-- from new public tables by the default privileges set in
-- 20260825120000_lock_postgrest_data_plane.sql. The explicit REVOKE repeats
-- that for this table so the boundary does not rest on one earlier file.
-- =============================================================================

ALTER TABLE public.apple_auth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.apple_auth_tokens FROM anon, authenticated;
