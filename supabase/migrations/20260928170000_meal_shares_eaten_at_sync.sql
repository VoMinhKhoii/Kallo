-- =============================================================================
-- Domain B: Database Security & Logic — meal_shares.eaten_at stays a copy of
-- meals.logged_at
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- The circle feeds place a meal by when it was EATEN, not when it was shared:
-- a meal logged for yesterday belongs under Yesterday even when it was shared
-- today. The eaten time lives on meals.logged_at, but the feeds filter on
-- meal_shares, and one index cannot span two tables — so meal_shares.eaten_at
-- (added by 20260928165947_meal_shares_eaten_at, with its two indexes) carries
-- a copy. A copy is only safe while nothing can let it drift, so the database
-- keeps it, not the app:
--
-- 1. meal_shares_copy_eaten_at — BEFORE INSERT OR UPDATE OF meal_id on
--    meal_shares. A new share (or one re-pointed at another meal) gets its
--    meal's logged_at, whatever the writer sent. This also covers the
--    still-serving previous app revision during a deploy, which inserts shares
--    without knowing the column exists. The app never writes eaten_at itself.
--
-- 2. meals_sync_share_eaten_at — AFTER UPDATE OF logged_at on meals. No path
--    moves a meal to another day today; when one does, its share follows.
--
-- 3. Backfill every existing share. Safe for the circle_events fan-out
--    (on_meal_share_changed, 20260601000000): its UPDATE branch emits only on a
--    private -> non-private edge, and this statement never touches visibility.
--
-- Both functions are SECURITY DEFINER with a pinned search_path so neither can
-- be starved by RLS (a share whose meal the invoker cannot read, a share row
-- the invoker cannot update); EXECUTE is revoked, as for every trigger
-- function (20260923051230).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Every share row carries its meal's eaten time
-- -----------------------------------------------------------------------------
-- FOR SHARE, not a plain read. A transaction moving the meal to another day
-- holds its row lock while its sync trigger (2) finds no share yet to update;
-- a plain SELECT here would read the old, still-committed logged_at and both
-- could commit with the copy stale forever. FOR SHARE waits for that
-- transaction and reads what it committed. The other order is covered too:
-- while this share's transaction holds FOR SHARE, the meal's UPDATE waits,
-- and its sync trigger then sees the committed share. (The FK check's FOR KEY
-- SHARE does not serialize these: it does not conflict with a non-key update.)
--
-- Not on every UPDATE: a share row locked by an UPDATE and then its meal
-- locked here is the reverse of a meal deletion's order (the meal, then its
-- share through the cascade), and the two could deadlock. Only an INSERT or a
-- change of meal_id — which nothing does — reaches the meal from here. A
-- re-share (visibility / shared_at) leaves eaten_at as it was.
CREATE OR REPLACE FUNCTION public.meal_shares_copy_eaten_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT m.logged_at INTO NEW.eaten_at
  FROM public.meals m
  WHERE m.id = NEW.meal_id
  FOR SHARE;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.meal_shares_copy_eaten_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.meal_shares_copy_eaten_at()
  FROM anon, authenticated;

CREATE TRIGGER meal_shares_copy_eaten_at
  BEFORE INSERT OR UPDATE OF meal_id ON public.meal_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.meal_shares_copy_eaten_at();

-- -----------------------------------------------------------------------------
-- 2. A meal moved to another day takes its share with it
-- -----------------------------------------------------------------------------
-- Writes the new logged_at straight across; it does not fire (1), which
-- listens only to meal_id. The meal row is already locked by the UPDATE that
-- fired this, so the order is meal then share, the same as a deletion.
CREATE OR REPLACE FUNCTION public.meals_sync_share_eaten_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.meal_shares
  SET eaten_at = NEW.logged_at
  WHERE meal_id = NEW.id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.meals_sync_share_eaten_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.meals_sync_share_eaten_at()
  FROM anon, authenticated;

CREATE TRIGGER meals_sync_share_eaten_at
  AFTER UPDATE OF logged_at ON public.meals
  FOR EACH ROW
  WHEN (OLD.logged_at IS DISTINCT FROM NEW.logged_at)
  EXECUTE FUNCTION public.meals_sync_share_eaten_at();

-- -----------------------------------------------------------------------------
-- 3. Backfill
-- -----------------------------------------------------------------------------
UPDATE public.meal_shares ms
SET eaten_at = m.logged_at
FROM public.meals m
WHERE m.id = ms.meal_id
  AND ms.eaten_at IS DISTINCT FROM m.logged_at;
