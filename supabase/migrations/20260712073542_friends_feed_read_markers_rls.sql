-- =============================================================================
-- Domain B: Database Security & Logic — friends_feed_read_markers RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- friends_feed_read_markers holds a private "when did you last check your
-- combined Friends feed" timestamp per user. Deliberately owner-only — unlike
-- public_profiles (whose RLS lets accepted friends read each other's rows for
-- names/avatars), this marker must never be readable by anyone but its owner,
-- since it's a behavioral signal (when you last looked), not a social field.
-- =============================================================================

ALTER TABLE public.friends_feed_read_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friends-feed read marker"
  ON public.friends_feed_read_markers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own friends-feed read marker"
  ON public.friends_feed_read_markers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own friends-feed read marker"
  ON public.friends_feed_read_markers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
