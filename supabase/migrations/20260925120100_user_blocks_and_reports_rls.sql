-- =============================================================================
-- Domain B (hand-authored): RLS for user_blocks + content_reports, and the
-- one-time conversion of legacy friendship blocks into user_blocks.
--
-- The tables themselves are Domain A (drizzle-kit, 20260925120000). This file
-- owns the policies and the backfill, and must never be overwritten by
-- `drizzle-kit generate`.
--
-- The app reads and writes both tables only on the Drizzle owner connection,
-- with the actor id taken from the session, and the API-role table grants
-- were already revoked wholesale by 20260825120000_lock_postgrest_data_plane.sql
-- (its default privileges cover tables created after it). The policies below
-- are belt and braces and describe intent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Backfill: friendships.status = 'blocked' → user_blocks
-- -----------------------------------------------------------------------------
-- Before this migration a block was the pair's one friendships row with
-- status 'blocked' — a single, undirected edge that could not say who blocked
-- whom. Each becomes one DIRECTED user_blocks row, blocker = requested_by.
--
-- Caveat, accepted: requested_by is exact only when the block created the
-- edge. When a pending/accepted edge was blocked later, the old upsert kept
-- the original requester, so the backfilled block may be attributed to the
-- other person. Reads are symmetric (either direction hides both people), so
-- visibility is unchanged; only which side may unblock can be wrong, and
-- either person can block again to hold their own row.
--
-- The guard skips a requested_by outside the pair (never written by the app,
-- but a corrupt row must not mint a block between strangers). Then every
-- blocked edge is deleted: blocking now ENDS the friendship, so the backfill
-- leaves the same state a fresh block would.
INSERT INTO public.user_blocks (blocker_id, blocked_id, created_at)
SELECT
  f.requested_by,
  CASE WHEN f.requested_by = f.user_low THEN f.user_high ELSE f.user_low END,
  f.updated_at
FROM public.friendships f
WHERE f.status = 'blocked'
  AND f.requested_by IN (f.user_low, f.user_high)
ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

DELETE FROM public.friendships WHERE status = 'blocked';

-- -----------------------------------------------------------------------------
-- 2. user_blocks RLS — a user manages only the blocks they placed
-- -----------------------------------------------------------------------------
-- A user may see, place and lift their own blocks. There is no policy that
-- exposes a row to the person who was blocked: a block must never be
-- observable from the other side.
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blockers can view own blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Blockers can place own blocks"
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Blockers can lift own blocks"
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

-- -----------------------------------------------------------------------------
-- 3. content_reports RLS — a reporter files and reads back their own reports
-- -----------------------------------------------------------------------------
-- No UPDATE and no DELETE policy, deliberately: triage status and resolved_at
-- are set by admins on the server, and a reporter must not be able to
-- withdraw or rewrite a report once filed. The absence of those policies is
-- the enforcement.
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can view own content reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Reporters can file content reports as themselves"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');
