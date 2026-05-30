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
-- SELECT is open to any authenticated user so that add-by-@handle works.
-- Handle harvesting is prevented at the APP layer: lookups are exact-match
-- only (no prefix / enumeration), never by listing the table. RLS only governs
-- row visibility; the column set here is already metric-free by construction.
--
-- INSERT / UPDATE are restricted to the row owner (user_id = auth.uid()).
-- =============================================================================

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view public profiles"
  ON public.public_profiles FOR SELECT
  TO authenticated
  USING (true);

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
