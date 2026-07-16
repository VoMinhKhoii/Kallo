-- =============================================================================
-- Domain B: Database Security & Logic — meal_share_invites RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- meal_share_invites (directed copy/split offers between friends):
--   SELECT visible to the two parties only (sender and recipient). No client
--   INSERT / UPDATE / DELETE policies are wired — every write goes through the
--   server actions on the Drizzle connection (which bypasses RLS), and those
--   actions re-scope every query to from_user_id / to_user_id. With RLS enabled
--   and no write policy, an authenticated client role cannot forge or mutate an
--   invite directly. This mirrors coach_assignments / circle_events.
-- =============================================================================

ALTER TABLE public.meal_share_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender and recipient can view their invite"
  ON public.meal_share_invites FOR SELECT
  TO authenticated
  USING (auth.uid() IN (from_user_id, to_user_id));
