-- =============================================================================
-- Domain B: Database Security & Logic — chat_group_members RLS recursion fix
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- The "Members can view fellow members" policy subqueried chat_group_members
-- from inside its own policy, which Postgres evaluates recursively (42P17,
-- "infinite recursion detected in policy") for authenticated PostgREST
-- clients. Replace the self-referential subquery with a SECURITY DEFINER
-- helper (pinned search_path — same pattern as the friendship helpers in
-- 20260530070801) that checks membership as the function owner, outside RLS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_chat_group_member(
  p_user_id uuid,
  p_group_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_group_members m
    WHERE m.group_id = p_group_id
      AND m.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_group_member(uuid, uuid)
  TO authenticated;

DROP POLICY IF EXISTS "Members can view fellow members"
  ON public.chat_group_members;

CREATE POLICY "Members can view fellow members"
  ON public.chat_group_members FOR SELECT
  TO authenticated
  USING (public.is_chat_group_member(auth.uid(), group_id));
