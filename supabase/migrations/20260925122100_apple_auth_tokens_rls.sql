-- =============================================================================
-- Domain B: Database Security & Logic — Sign in with Apple tables server-only
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- apple_auth_tokens: one sealed Sign in with Apple refresh token per user,
-- written by POST /api/v1/auth/apple/token.
-- apple_token_revocations: the account-deletion outbox that revokes those
-- tokens after the auth user (and so apple_auth_tokens) is gone.
--
-- Both are read and written only on the Drizzle owner connection with an
-- explicit predicate. RLS is enabled with no client policies so PostgREST can
-- never read a credential, even sealed; the API-role grants are already
-- withheld from new public tables by the default privileges set in
-- 20260825120000_lock_postgrest_data_plane.sql. The explicit REVOKE repeats
-- that for these tables so the boundary does not rest on one earlier file.
-- =============================================================================

ALTER TABLE public.apple_auth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apple_auth_tokens FROM anon, authenticated;

ALTER TABLE public.apple_token_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apple_token_revocations FROM anon, authenticated;
