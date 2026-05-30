-- =============================================================================
-- Domain B: Database Security & Logic — public_profiles RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- public_profiles is the identity projection table. It holds ONLY the
-- cross-user-visible social fields (handle, display_name, avatar_seed) and is
-- the ONLY table from which another user's social identity may be read.
-- Reading these columns therefore can NEVER leak body metrics — those live in
-- user_profiles under its untouched owner-only SELECT policy.
--
-- SELECT is SCOPED: a user may read only their own profile, the profile of any
-- user they share a friendship edge with (pending/accepted/blocked), or — for a
-- later coach console — an assigned client's profile. This makes the table
-- non-enumerable at the PostgREST boundary: a raw /rest/v1/public_profiles call
-- can no longer dump the handle directory. Add-by-@handle still works via the
-- public.search_public_profile(text) SECURITY DEFINER RPC below, which returns
-- at most one EXACT-match row (no prefix / enumeration). The column set here is
-- already metric-free by construction, so even a leaked row carries no body data.
--
-- INSERT / UPDATE are restricted to the row owner (user_id = auth.uid()).
-- =============================================================================

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view related public profiles"
  ON public.public_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_low = least(auth.uid(), public_profiles.user_id)
        AND f.user_high = greatest(auth.uid(), public_profiles.user_id)
    )
    OR public.is_active_coach_of(auth.uid(), public_profiles.user_id)
  );

CREATE POLICY "Users can insert own public profile"
  ON public.public_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own public profile"
  ON public.public_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reuse the shared updated_at trigger function (defined in 20260228155945).
CREATE TRIGGER on_public_profiles_updated
  BEFORE UPDATE ON public.public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Exact-match handle search (add-by-@handle) — non-enumerable.
-- SECURITY DEFINER so it can resolve a handle the caller is not yet related to,
-- but it returns at most ONE row and ONLY on an EXACT (lowercased) handle match,
-- so it cannot be used to enumerate or prefix-scan the directory. It never
-- returns the caller's own row. This is the supported path for any direct
-- Supabase-client search now that the table SELECT policy is scoped.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_public_profile(p_handle text)
  RETURNS TABLE (user_id uuid, handle text, display_name text, avatar_seed text)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT pp.user_id, pp.handle, pp.display_name, pp.avatar_seed
  FROM public.public_profiles pp
  WHERE pp.handle = lower(p_handle)
    AND pp.user_id <> auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.search_public_profile(text) FROM public;
GRANT EXECUTE ON FUNCTION public.search_public_profile(text) TO authenticated;
