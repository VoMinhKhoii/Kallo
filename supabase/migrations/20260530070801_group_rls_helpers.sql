-- =============================================================================
-- Domain B: Database Security & Logic — Group Tracking RLS helpers
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- This migration is managed manually. It defines the two SECURITY DEFINER
-- helper functions that the additive Group Tracking SELECT policies depend on:
--
--   public.is_accepted_friend(viewer, owner)  — pairwise accepted friendship
--   public.is_active_coach_of(coach, client)  — active coach assignment
--
-- Both are LANGUAGE sql SECURITY DEFINER with a pinned search_path (the same
-- safe pattern as handle_new_user in 20260224100032). SECURITY DEFINER lets the
-- function read friendships / coach_assignments without recursing into the
-- caller's RLS, while the pinned search_path closes the mutable-search-path
-- privilege-escalation vector. STABLE because they only read.
--
-- Ordering note: this migration MUST precede meal_shares_rls, coach_circle_rls,
-- and circle_meal_visibility, all of which call these helpers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_accepted_friend(viewer, owner)
-- TRUE when viewer and owner have an accepted friendship row. friendships are
-- canonical-ordered (user_low < user_high), so we normalize the pair with
-- least()/greatest() before matching.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_accepted_friend(viewer uuid, owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND f.user_low = least(viewer, owner)
      AND f.user_high = greatest(viewer, owner)
  );
$$;

-- -----------------------------------------------------------------------------
-- is_active_coach_of(coach, client)
-- TRUE when coach has an active coach_assignments row for client. Dormant in
-- the MVP (no writes are wired to coach_assignments) but shipped now so the
-- coach OR-branch in the meals SELECT policy needs no later migration.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_coach_of(coach uuid, client uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_assignments ca
    WHERE ca.coach_id = coach
      AND ca.client_id = client
      AND ca.status = 'active'
  );
$$;
