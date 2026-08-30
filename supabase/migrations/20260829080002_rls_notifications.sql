-- =============================================================================
-- Domain B: Database Security & Logic — notifications server-only
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Notification rows are written by producers and read by the activity feed
-- exclusively through server actions on the Drizzle owner connection, which
-- carry an explicit recipient_id predicate. RLS is enabled with no client
-- policies so PostgREST can never read another person's activity; the API-role
-- grants were already revoked wholesale by
-- 20260825120000_lock_postgrest_data_plane.sql.
-- =============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
