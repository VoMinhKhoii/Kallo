-- =============================================================================
-- Domain B: Database Security & Logic — chat_group_members.last_read_at UPDATE
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- A member marks their own row read (listChatGroupMessages bumps last_read_at
-- to now() when they open a thread). Self-only.
-- =============================================================================

CREATE POLICY "A member can update their own read marker"
  ON public.chat_group_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
