-- =============================================================================
-- Domain B: Database Security & Logic — caller-bound relationship helpers
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- is_accepted_friend, is_active_coach_of and is_friend_since answer only for
-- the caller: each returns false unless its first argument is auth.uid() (and
-- false with no session). Every RLS policy already passes auth.uid() first and
-- no server code calls them, so policy results are unchanged; a direct call
-- can no longer ask about a pair the caller is not part of.
--
-- Signatures, STABLE, SECURITY DEFINER and the pinned search_path match the
-- latest definitions (20260530070801, 20260923051230). CREATE OR REPLACE keeps
-- every existing EXECUTE grant, so this adds no permission-denied call path
-- (docs/RATE_LIMITING.md, "Do not execute a denied function AS anon").
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_accepted_friend(viewer uuid, owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(viewer = auth.uid(), false) AND EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND f.user_low = least(viewer, owner)
      AND f.user_high = greatest(viewer, owner)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_coach_of(coach uuid, client uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(coach = auth.uid(), false) AND EXISTS (
    SELECT 1
    FROM public.coach_assignments ca
    WHERE ca.coach_id = coach
      AND ca.client_id = client
      AND ca.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_friend_since(
  viewer uuid,
  owner uuid,
  ts timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(viewer = auth.uid(), false) AND EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND f.user_low = least(viewer, owner)
      AND f.user_high = greatest(viewer, owner)
      AND f.accepted_at <= ts
  );
$$;
