-- =============================================================================
-- Domain B: Database Security & Logic — push_tokens server-only
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Device registration tokens are written by the /api/v1/notifications/
-- push-tokens route and read by the send pipeline, both on the Drizzle owner
-- connection carrying an explicit user_id predicate. RLS is enabled with no
-- client policies so PostgREST can never enumerate another person's devices
-- (a token is a send capability); the API-role grants were already revoked
-- wholesale by 20260825120000_lock_postgrest_data_plane.sql.
-- =============================================================================

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
