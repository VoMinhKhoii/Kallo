-- =============================================================================
-- Domain B: Database Security & Logic — invite consent
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- friend_removals and released_handles are created in
-- 20261102191800_add_friend_removals_and_released_handles.sql.
--
-- 1. Both tables are server-only: RLS on, every client-role grant revoked.
--    Each gets an owner-only SELECT policy (like user_blocks' own-row
--    policies), which is inert while no client role holds a grant and keeps
--    any later grant to the caller's own rows.
-- 2. public_profiles_reserve_handle: the handle is the invite link, so a
--    handle one person gave up must never be issued to anyone else.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Server-only tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.friend_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.friend_removals FROM anon, authenticated;

CREATE POLICY "Removers can view own removals"
  ON public.friend_removals FOR SELECT
  TO authenticated
  USING (auth.uid() = remover_id);

ALTER TABLE public.released_handles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.released_handles FROM anon, authenticated;

CREATE POLICY "Previous owners can view own released handles"
  ON public.released_handles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. A released handle stays reserved for the person who gave it up
-- -----------------------------------------------------------------------------
-- One row trigger covers every way a handle changes hands:
--   - a handle being given up (UPDATE to another handle, or DELETE — the
--     account-delete cascade from auth.users included) is recorded in
--     released_handles for its owner, permanently;
--   - a handle being claimed (INSERT, or UPDATE to it) is refused when it is
--     reserved for someone else; when it is the claimant's own reservation,
--     the reservation is deleted (they took it back).
-- The refusal is raised as a unique violation (23505) on the handle, so the
-- app treats a reserved handle exactly like a taken one: a direct claim is a
-- 409, a rename retries with a digit suffix, a generated slug retries.
--
-- Each handle involved is locked (transaction-scoped advisory lock) before the
-- check, so a claim racing a release of the same handle waits for it and then
-- sees the reservation. An UPDATE locks two handles, always in sorted order,
-- so two people swapping handles cannot deadlock. Every path that already has
-- a profile row takes the row lock before any handle lock (an upsert defers
-- to its UPDATE), so a row lock never waits behind a handle lock. API roles have no grants on
-- public_profiles (20260825120000): writes come from the app's owner
-- connection or the auth.users cascade, which runs as the table owner.
CREATE OR REPLACE FUNCTION public.public_profiles_reserve_handle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  claimed text;
  released text;
  owner_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    released := OLD.handle;
    owner_id := OLD.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.handle IS NOT DISTINCT FROM OLD.handle THEN
      RETURN NEW;
    END IF;
    claimed := NEW.handle;
    released := OLD.handle;
    owner_id := NEW.user_id;
  ELSE
    -- An upsert for an account that already has a profile becomes an UPDATE
    -- (ON CONFLICT (user_id) DO UPDATE), and that UPDATE fires this trigger
    -- again with the row locked, where the handle is checked. Locking the
    -- handle here, before the row, would invert that order against a
    -- concurrent handle change on the same row and deadlock (40P01). A plain
    -- read takes no lock, and an INSERT that conflicts writes no handle.
    IF EXISTS (
      SELECT 1 FROM public.public_profiles p WHERE p.user_id = NEW.user_id
    ) THEN
      RETURN NEW;
    END IF;
    claimed := NEW.handle;
    owner_id := NEW.user_id;
  END IF;

  IF claimed IS NOT NULL AND released IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('profile-handle:' || LEAST(claimed, released), 0));
    PERFORM pg_advisory_xact_lock(
      hashtextextended('profile-handle:' || GREATEST(claimed, released), 0));
  ELSE
    PERFORM pg_advisory_xact_lock(
      hashtextextended('profile-handle:' || COALESCE(claimed, released), 0));
  END IF;

  IF claimed IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.released_handles r
      WHERE r.handle = claimed AND r.user_id <> owner_id
    ) THEN
      RAISE EXCEPTION 'handle is reserved for its previous owner'
        USING ERRCODE = 'unique_violation',
              CONSTRAINT = 'public_profiles_handle_uniq';
    END IF;
    DELETE FROM public.released_handles r
    WHERE r.handle = claimed AND r.user_id = owner_id;
  END IF;

  IF released IS NOT NULL THEN
    -- A row can only already exist for this owner (anyone else's would have
    -- refused their claim above), so keeping it keeps the first release time.
    INSERT INTO public.released_handles (handle, user_id)
    VALUES (released, owner_id)
    ON CONFLICT (handle) DO NOTHING;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER public_profiles_reserve_handle
  BEFORE INSERT OR UPDATE OF handle OR DELETE ON public.public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.public_profiles_reserve_handle();
