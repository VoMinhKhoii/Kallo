-- =============================================================================
-- Domain B: Database Security & Logic — chat_groups / chat_group_members /
-- chat_group_messages RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- One chat concept: a group is N >= 2 members ('direct' 2-person chats,
-- auto-created on friend accept, or user-created named 'group' chats). As
-- with friendships, the Drizzle `db` singleton writes as the owner role and
-- bypasses RLS — these policies are the PostgREST-boundary backstop; the
-- server actions in lib/actions/chat-groups.ts do the real authorization
-- (e.g. inserting a member row for someone other than the caller, same
-- precedent as acceptInvite's requested_by write).
-- =============================================================================

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- chat_groups
-- ---------------------------------------------------------------------------

CREATE POLICY "Members can view their chat groups"
  ON public.chat_groups FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT group_id FROM public.chat_group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Creator can create a chat group"
  ON public.chat_groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE TRIGGER on_chat_groups_updated
  BEFORE UPDATE ON public.chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- chat_group_members
-- ---------------------------------------------------------------------------

CREATE POLICY "Members can view fellow members"
  ON public.chat_group_members FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM public.chat_group_members
      WHERE user_id = auth.uid()
    )
  );

-- Self-insert only at the RLS boundary — the "tap to join" model has no
-- direct-client path here (membership only ever comes from createChatGroup
-- or the automatic direct-chat creation, both server-side owner-role writes).
CREATE POLICY "A user can add themself as a member"
  ON public.chat_group_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- chat_group_messages
-- ---------------------------------------------------------------------------

CREATE POLICY "Members can view messages in their groups"
  ON public.chat_group_messages FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM public.chat_group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages as themself"
  ON public.chat_group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND group_id IN (
      SELECT group_id FROM public.chat_group_members
      WHERE user_id = auth.uid()
    )
  );
