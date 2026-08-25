-- Close the direct-PostgREST data plane, and repair two policies that were
-- load-bearing while it was open.
--
-- The app has no PostgREST usage at all: the browser and Flutter Supabase
-- clients are auth-only (and `app/api/supabase-proxy` is hard-scoped to
-- `auth/v1/*`), while the server reaches Postgres directly over DATABASE_URL
-- and therefore never assumes the `anon` / `authenticated` roles. But
-- NEXT_PUBLIC_SUPABASE_URL and the publishable key ship in the browser bundle,
-- so any user holding a JWT could bypass the server entirely and speak to
-- `<project>.supabase.co/rest/v1` directly. RLS was the only thing in the way,
-- which made every policy bug a data-plane bug.
--
-- One of them was: see the friendships INSERT policy below.
--
-- Revoking the table grants closes /rest/v1 AND /graphql/v1 in one move, since
-- pg_graphql rides the same privileges. Verified against 24h of production edge
-- logs first: the only /rest/v1 traffic was a single host enumerating table
-- names, every response an empty array (RLS held, no JWT). No legitimate
-- caller exists to break.
--
-- Schema USAGE is deliberately NOT revoked: the table grants already close all
-- data access, and dropping USAGE would risk public-schema functions invoked
-- from storage/auth policy contexts for no further gain.

-- 1. Close every existing table to the two PostgREST roles. RLS policies stay
--    exactly as they are — belt and braces, and they still describe intent.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2. Close tables added later. Bound `FOR ROLE postgres` because Supabase's
--    shipped default ACLs are registered for that role and `supabase db push`
--    connects as it — without the clause this silently binds to whichever role
--    happens to run the migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 3. friendships: the INSERT policy checked that the caller is a party and the
--    requester, but never constrained `status` — so a direct insert of
--    status='accepted' minted a friendship with no consent from the other
--    party, and skipped the free-tier friend cap on the way. The UPDATE policy
--    already gets this right (accepting requires being the non-requester);
--    this brings INSERT in line: you may only ever create a *pending* request.
DROP POLICY IF EXISTS "Requester can create a friendship request" ON public.friendships;
CREATE POLICY "Requester can create a friendship request"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (user_low, user_high)
    AND auth.uid() = requested_by
    AND status = 'pending'
  );

-- 4. user_profiles.created_at (the free-trial anchor) needs nothing here: it is
--    already pinned by `preserve_user_profile_created_at`
--    (20260728123400_harden_billing_trial_anchor.sql), which rewrites the value
--    back to OLD on every UPDATE. `user_id` needs nothing either — the UPDATE
--    policy carries no WITH CHECK, so Postgres reuses USING (auth.uid() =
--    user_id) as the new-row check and a caller cannot reassign the row to
--    somebody else. Both were checked against production before this migration.
