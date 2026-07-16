-- =============================================================================
-- Domain B: Database Security & Logic — chat tables server-only + portion CHECKs
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- 1) CHAT TABLES ARE SERVER-ONLY. Every read and write of chat_groups /
--    chat_group_members / chat_group_messages goes through server actions on
--    the Drizzle owner connection (which bypasses RLS). There is NO browser
--    PostgREST path: no client-side `.from()` on these tables, no Realtime
--    subscription, and message send is a server action. The permissive
--    `authenticated` policies shipped in 20260708111205 / 20260708141500 were
--    therefore an unused attack surface on the PostgREST path that a hostile
--    client (public anon key + its own JWT) could reach directly, bypassing
--    the server-side authorization:
--      - self-insert a membership row into ANY group by UUID (join arbitrary
--        chats), then read every member's non-private meals;
--      - update one's own membership group_id/role;
--      - create a chat_group for an arbitrary victim direct-pair and squat it;
--      - a removed/blocked friend keeps reading a direct chat via the stale
--        membership row (SELECT authorized from membership alone).
--    Also removes the self-referential "Members can view fellow members"
--    policy whose subquery caused 42P17 recursion.
--
--    Drop EVERY authenticated policy so RLS (enabled, no policy) denies all
--    client access to these tables. Server owner-role access is unaffected.
--    When a client read path is introduced (redesign PR B adds the message
--    composer / timeline), it must ship correctly-scoped policies — direct
--    groups gated on a current accepted friendship via public.is_accepted_friend.
--
-- 2) PORTION FACTOR RANGE. portion_factor is a natural fraction in (0, 1].
--    A DB CHECK stops corruption (0 / NaN / >1 / negative) from silently
--    becoming a full portion at the app layer (`Number(value) || 1`).
-- =============================================================================

-- 1) Chat tables → server-only (deny all client/PostgREST access).
DROP POLICY IF EXISTS "Creator can create a chat group" ON public.chat_groups;
DROP POLICY IF EXISTS "Members can view their chat groups" ON public.chat_groups;
DROP POLICY IF EXISTS "A user can add themself as a member"
  ON public.chat_group_members;
DROP POLICY IF EXISTS "A member can update their own read marker"
  ON public.chat_group_members;
DROP POLICY IF EXISTS "Members can view fellow members"
  ON public.chat_group_members;
DROP POLICY IF EXISTS "Members can view messages in their groups"
  ON public.chat_group_messages;
DROP POLICY IF EXISTS "Members can send messages as themself"
  ON public.chat_group_messages;

-- 2) portion_factor ∈ (0, 1] on both carriers.
ALTER TABLE public.meals
  ADD CONSTRAINT meals_portion_factor_range
  CHECK (portion_factor > 0 AND portion_factor <= 1);

ALTER TABLE public.meal_share_invites
  ADD CONSTRAINT meal_share_invites_portion_factor_range
  CHECK (portion_factor > 0 AND portion_factor <= 1);
