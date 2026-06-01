-- =============================================================================
-- Group Tracking — Both-directions RLS test suite (pgTAP)  [Phase E1, merge gate]
--
-- Run locally with:  supabase test db
-- (Requires a local stack started via `supabase start`; pgTAP ships with the
--  Supabase local Postgres image. This file NEVER touches a remote DB.)
--
-- This suite proves the six security properties from the build plan (E1) in
-- BOTH directions — every positive (a friend/coach CAN see X) is paired with a
-- negative (an unrelated user, or a friend with no share, sees ZERO):
--
--   (a) accepted friend WITH a 'circle' meal_shares row SEES the meal.
--   (b) accepted friend with NO share row sees ZERO  (opt-in to exposure).
--   (c) unrelated user sees ZERO across meals AND meal_items.
--   (d) active coach sees an assigned client's shared meals; a non-assigned
--       coach sees ZERO; client -> client sees ZERO.
--   (e) any peer/coach query touching body_weight_log returns ZERO.
--   (f) cross-user public_profiles SELECT returns handle/display_name, but
--       cross-user user_profiles SELECT of weight_kg / tdee_kcal returns ZERO.
--
-- How auth.uid() is simulated: Supabase's auth.uid() reads the 'sub' claim from
-- current_setting('request.jwt.claims'). The helper authenticate_as(uuid) sets
-- that claim and `SET LOCAL ROLE authenticated`, so the policies (which are all
-- `TO authenticated`) evaluate exactly as they would for a real signed-in user.
-- Setup runs as the test/superuser role (RLS-exempt) so fixtures can be planted
-- directly; each assertion first switches into the user under test.
-- =============================================================================

BEGIN;

SELECT plan(20);

-- -----------------------------------------------------------------------------
-- Fixtures (planted as the privileged test role, bypassing RLS)
-- -----------------------------------------------------------------------------

-- Stable UUIDs for the actors in the scenario.
--   owner       : logs meals and opts a meal into the circle.
--   friend      : accepted friend of owner.
--   stranger    : no relationship to owner.
--   coach       : active coach of owner (client = owner).
--   other_coach : a coach, but NOT assigned to owner.
\set owner_id       '11111111-1111-1111-1111-111111111111'
\set friend_id      '22222222-2222-2222-2222-222222222222'
\set stranger_id    '33333333-3333-3333-3333-333333333333'
\set coach_id       '44444444-4444-4444-4444-444444444444'
\set other_coach_id '55555555-5555-5555-5555-555555555555'

-- Auth users. Inserting into auth.users fires public.handle_new_user(), which
-- auto-creates a matching public.user_profiles row for each.
INSERT INTO auth.users (id, email)
VALUES
  (:'owner_id',       'owner@test.local'),
  (:'friend_id',      'friend@test.local'),
  (:'stranger_id',    'stranger@test.local'),
  (:'coach_id',       'coach@test.local'),
  (:'other_coach_id', 'other_coach@test.local');

-- public_profiles: the cross-user-visible identity projection (metric-free).
INSERT INTO public.public_profiles (user_id, handle, display_name, avatar_seed)
VALUES
  (:'owner_id',  'owner_handle',  'Owner Person',  'seed-owner'),
  (:'friend_id', 'friend_handle', 'Friend Person', 'seed-friend');

-- user_profiles already exist (auto-created by the signup trigger). Load the
-- owner's row with body metrics that MUST stay owner-only.
UPDATE public.user_profiles
SET weight_kg = 72.50, tdee_kcal = 2400, calorie_target = 2000
WHERE user_id = :'owner_id';

-- friendships: owner <-> friend, ACCEPTED. Canonical ordering user_low<user_high.
INSERT INTO public.friendships (user_low, user_high, status, requested_by)
VALUES (
  least(:'owner_id'::uuid, :'friend_id'::uuid),
  greatest(:'owner_id'::uuid, :'friend_id'::uuid),
  'accepted',
  :'owner_id'
);

-- coach_assignments: coach is an ACTIVE coach of owner. other_coach is NOT.
INSERT INTO public.coach_assignments (coach_id, client_id, rank, status)
VALUES (:'coach_id', :'owner_id', 'primary', 'active');

-- Owner's two meals:
--   shared_meal   -> opted into the circle (visibility = 'circle').
--   private_meal  -> never shared (no meal_shares row at all).
\set shared_meal_id  '99999999-0000-0000-0000-000000000001'
\set private_meal_id '99999999-0000-0000-0000-000000000002'

INSERT INTO public.meals (id, user_id, raw_input, calories_kcal, protein_g, carbohydrate_g, fat_g)
VALUES
  (:'shared_meal_id',  :'owner_id', 'bún chả',  760, 38, 70, 22),
  (:'private_meal_id', :'owner_id', 'phở bò',   620, 35, 60, 15);

-- One meal_item under each meal (to prove item visibility tracks the parent).
INSERT INTO public.meal_items (meal_id, ingredient_name, meal_item_name)
VALUES
  (:'shared_meal_id',  'pork',       'grilled pork'),
  (:'private_meal_id', 'beef broth', 'pho broth');

-- The explicit opt-in share row for shared_meal (fires the fanout trigger).
INSERT INTO public.meal_shares (meal_id, actor_id, visibility)
VALUES (:'shared_meal_id', :'owner_id', 'circle');

-- Body weight entry for owner — must NEVER be visible to any peer/coach.
INSERT INTO public.body_weight_log (user_id, logged_date, weight_kg)
VALUES (:'owner_id', current_date, 72.50);

-- =============================================================================
-- (a) Accepted friend WITH a 'circle' share SEES the shared meal.   [positive]
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'friend_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.meals WHERE id = :'shared_meal_id'),
  1,
  '(a) accepted friend with a circle share SEES the shared meal'
);

SELECT is(
  (SELECT count(*)::int FROM public.meal_items WHERE meal_id = :'shared_meal_id'),
  1,
  '(a) accepted friend SEES the shared meal''s items'
);

-- =============================================================================
-- (b) Accepted friend with NO share row sees ZERO (opt-in proven).  [negative]
--     Same friend, but the private (never-shared) meal must be invisible.
-- =============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.meals WHERE id = :'private_meal_id'),
  0,
  '(b) accepted friend sees ZERO for an owner meal with no circle share row'
);

SELECT is(
  (SELECT count(*)::int FROM public.meal_items WHERE meal_id = :'private_meal_id'),
  0,
  '(b) accepted friend sees ZERO items for an unshared owner meal'
);

RESET ROLE;

-- =============================================================================
-- (c) Unrelated user sees ZERO across meals AND meal_items.         [negative]
--     stranger has no friendship and no coach link to owner.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'stranger_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.meals
     WHERE id IN (:'shared_meal_id', :'private_meal_id')),
  0,
  '(c) unrelated user sees ZERO meals (even the circle-shared one)'
);

SELECT is(
  (SELECT count(*)::int FROM public.meal_items
     WHERE meal_id IN (:'shared_meal_id', :'private_meal_id')),
  0,
  '(c) unrelated user sees ZERO meal_items'
);

SELECT is(
  (SELECT count(*)::int FROM public.meal_shares
     WHERE actor_id = :'owner_id'),
  0,
  '(c) unrelated user sees ZERO of the owner''s meal_shares rows'
);

RESET ROLE;

-- =============================================================================
-- (d) Coach visibility, both directions.
--     active coach -> SEES assigned client's shared meals  [positive]
--     non-assigned coach -> ZERO                           [negative]
--     client -> client (friend querying via coach path) -> ZERO already
--               proven by (b); here we add stranger-as-fake-coach = ZERO.
-- =============================================================================

-- d.positive: active coach SEES the assigned client's meals (coach OR-branch
-- exposes BOTH shared and private meals of the assigned client by design).
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'coach_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.meals WHERE id = :'shared_meal_id'),
  1,
  '(d) active coach SEES the assigned client''s shared meal'
);

SELECT is(
  (SELECT count(*)::int FROM public.meal_items WHERE meal_id = :'shared_meal_id'),
  1,
  '(d) active coach SEES the assigned client''s shared meal items'
);

RESET ROLE;

-- d.negative: a non-assigned coach sees ZERO of owner's meals.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'other_coach_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.meals
     WHERE id IN (:'shared_meal_id', :'private_meal_id')),
  0,
  '(d) a non-assigned coach sees ZERO of the owner''s meals'
);

SELECT is(
  (SELECT count(*)::int FROM public.meal_items
     WHERE meal_id IN (:'shared_meal_id', :'private_meal_id')),
  0,
  '(d) a non-assigned coach sees ZERO of the owner''s meal_items'
);

RESET ROLE;

-- d.negative (client -> client): the friend (a peer/"client") must NOT gain
-- coach-style blanket visibility — only the explicitly shared meal, never the
-- private one. (Re-asserts the peer can't read the private meal via any path.)
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'friend_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.coach_assignments
     WHERE client_id = :'owner_id'),
  0,
  '(d) client->client: a peer sees ZERO of the owner''s coach_assignments'
);

SELECT is(
  (SELECT count(*)::int FROM public.meals WHERE id = :'private_meal_id'),
  0,
  '(d) client->client: a peer gets NO blanket (coach-style) access to private meals'
);

RESET ROLE;

-- =============================================================================
-- (e) body_weight_log returns ZERO for any peer or coach.           [negative]
--     Tested from the friend AND from the active coach.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'friend_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.body_weight_log WHERE user_id = :'owner_id'),
  0,
  '(e) an accepted friend sees ZERO body_weight_log rows'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'coach_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.body_weight_log WHERE user_id = :'owner_id'),
  0,
  '(e) an active coach sees ZERO body_weight_log rows (no social policy added)'
);

RESET ROLE;

-- =============================================================================
-- (f) Identity directory is SCOPED + non-enumerable; metrics stay owner-only.
--     stranger table SELECT of a profile  -> ZERO   (non-enumerable) [negative]
--     stranger exact-match RPC            -> resolves the owner      [positive]
--     stranger partial/prefix RPC         -> ZERO   (no harvest)     [negative]
--     stranger user_profiles body metrics -> ZERO                    [negative]
--     accepted friend table SELECT        -> handle VISIBLE          [positive]
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'stranger_id', 'role', 'authenticated')::text,
  true
);

-- A stranger cannot enumerate the directory through the table itself.
SELECT is(
  (SELECT count(*)::int FROM public.public_profiles WHERE user_id = :'owner_id'),
  0,
  '(f) a stranger sees ZERO public_profiles rows via the table (non-enumerable)'
);

-- ...but the exact-match RPC still resolves a handle for a non-friend, so
-- add-by-@handle keeps working.
SELECT is(
  (SELECT count(*)::int FROM public.search_public_profile('owner_handle')
     WHERE user_id = :'owner_id'),
  1,
  '(f) exact-match RPC resolves the owner handle for a non-friend (add-by-@handle works)'
);

-- A partial handle resolves NOTHING — no prefix/enumeration harvest.
SELECT is(
  (SELECT count(*)::int FROM public.search_public_profile('owner')),
  0,
  '(f) a partial handle returns ZERO via the RPC (no prefix enumeration)'
);

-- Body metrics never leak cross-user.
SELECT is(
  (SELECT count(*)::int FROM public.user_profiles WHERE user_id = :'owner_id'),
  0,
  '(f) cross-user user_profiles SELECT returns ZERO rows (body metrics never leak)'
);

RESET ROLE;

-- An accepted friend CAN read the owner's identity (needed for the circle feed).
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'friend_id', 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT handle FROM public.public_profiles WHERE user_id = :'owner_id'),
  'owner_handle',
  '(f) an accepted friend CAN read the owner handle via the table'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
