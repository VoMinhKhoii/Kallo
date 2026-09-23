-- =============================================================================
-- Domain B: Database Security & Logic — friends see only post-connection shares
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- KALLO-03. Accepting a friend used to expose every 'circle' share the other
-- person had ever made, including the backlog from before the two connected.
-- friendships.accepted_at (added by 20260923031030_circle_share_default_off)
-- now bounds that: a friend sees a share only when shared_at >= accepted_at.
-- The server enforces the same rule (friendSinceSql in
-- lib/domain/social/shares/share-visibility.ts);
-- these policies keep the (PostgREST-locked, see 20260825120000) RLS layer in
-- step with it as defence in depth.
--
-- 1. Backfill accepted_at for edges that are already accepted. The best record
--    of when an edge was accepted is updated_at: acceptInvite either inserts
--    the row as 'accepted' (updated_at = created_at) or promotes a pending row
--    (updated_at = the promote), and an accepted row is never updated again
--    (the only other writer, blockFriend, moves it out of 'accepted').
--    COALESCE to created_at keeps the statement total even though updated_at
--    is NOT NULL today.
--    Effect on existing friendships: a friend keeps every share made at or
--    after that timestamp and loses sight of shares made before they
--    connected — exactly what accepted_at means for a new friendship. No share
--    row and no user preference is modified.
--
-- 2. friendships_set_accepted_at trigger. Runs AFTER the backfill (its UPDATE
--    would otherwise be pinned to OLD). It makes the column authoritative in
--    the database: stamped with clock_timestamp() at the instant an edge
--    becomes 'accepted' (see the timestamp note on the function), immutable
--    while it stays accepted (so it can never be moved back to re-expose
--    history), and cleared when it leaves 'accepted'. The trigger is the only
--    writer — acceptInvite leaves the column to it — and it also covers the
--    still-serving previous app revision during a deploy, which inserts
--    accepted edges without knowing the column exists.
--
-- 3. public.is_friend_since(viewer, owner, ts) — is_accepted_friend plus the
--    time bound. SECURITY DEFINER + pinned search_path, same pattern and same
--    authenticated EXECUTE grant as is_accepted_friend (20260530070801).
--
-- 4. Replace the friend branch of the meal_shares, meals, meal_items and
--    circle_events SELECT policies with is_friend_since. Owner and coach
--    branches are unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Backfill
-- -----------------------------------------------------------------------------
-- on_friendships_updated would stamp updated_at = now() on every backfilled
-- row, and listCircle / the circle feed's friend cap order by updated_at — so
-- it is paused for this one statement to leave that ordering untouched.
ALTER TABLE public.friendships DISABLE TRIGGER on_friendships_updated;

UPDATE public.friendships
SET accepted_at = COALESCE(updated_at, created_at)
WHERE status = 'accepted'
  AND accepted_at IS NULL;

ALTER TABLE public.friendships ENABLE TRIGGER on_friendships_updated;

-- -----------------------------------------------------------------------------
-- 2. Keep accepted_at authoritative
-- -----------------------------------------------------------------------------
-- Which clock. A friend sees a share when shared_at >= accepted_at, and the
-- two values come from different transactions:
--
--   * meal_shares.shared_at defaults to now() — the share transaction's START
--     (the re-share path in meal-visibility.ts also writes now()). That is the
--     earliest instant attributable to the share, so the comparison can only
--     err towards hiding it. clock_timestamp() there would make shares look
--     later than they are and widen what a new friend sees.
--   * accepted_at must be the latest instant attributable to the acceptance:
--     the moment this trigger flips the status. now() is the acceptance
--     transaction's START, so a share made after that transaction began but
--     committed before the edge flipped would satisfy shared_at >= accepted_at
--     and leak a pre-connection share. statement_timestamp() has the same hole
--     when the UPDATE waits on a row lock before this trigger runs.
--     clock_timestamp() is read here, after any lock wait, at the transition.
--
-- With that pairing, a share whose transaction committed before the edge
-- became accepted is always hidden: its shared_at <= its commit < the
-- transition = accepted_at. A share whose transaction merely overlaps the
-- transition is hidden too (it started earlier); the owner can re-share it,
-- which bumps shared_at. The one share that becomes visible without being
-- committed after the acceptance COMMIT is one whose transaction STARTED after
-- the status flip, inside the few statements acceptInvite runs before
-- committing (event + direct chat) — made after the accept was already
-- decided, not backlog, and invisible to everyone until the accept commits.
-- Closing even that would need a commit timestamp, which Postgres does not
-- expose to a trigger. Both clocks are the database's, never an app server's.
CREATE OR REPLACE FUNCTION public.friendships_set_accepted_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'accepted' THEN
    NEW.accepted_at := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted' THEN
    NEW.accepted_at := clock_timestamp();
  ELSE
    NEW.accepted_at := OLD.accepted_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.friendships_set_accepted_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.friendships_set_accepted_at()
  FROM anon, authenticated;

CREATE TRIGGER friendships_set_accepted_at
  BEFORE INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.friendships_set_accepted_at();

-- -----------------------------------------------------------------------------
-- 3. is_friend_since(viewer, owner, ts)
-- -----------------------------------------------------------------------------
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
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND f.user_low = least(viewer, owner)
      AND f.user_high = greatest(viewer, owner)
      AND f.accepted_at <= ts
  );
$$;

-- New functions are born without anon/authenticated EXECUTE
-- (20260829045200); the policies below run as authenticated.
REVOKE ALL ON FUNCTION public.is_friend_since(uuid, uuid, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_friend_since(uuid, uuid, timestamptz)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Circle can view meal shares" ON public.meal_shares;
CREATE POLICY "Circle can view meal shares"
  ON public.meal_shares FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR (
      visibility <> 'private'
      AND public.is_friend_since(auth.uid(), actor_id, shared_at)
    )
    OR (visibility <> 'private' AND public.is_active_coach_of(auth.uid(), actor_id))
  );

DROP POLICY IF EXISTS "Circle friends can view shared meals" ON public.meals;
CREATE POLICY "Circle friends can view shared meals"
  ON public.meals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meal_shares ms
      WHERE ms.meal_id = meals.id
        AND ms.visibility = 'circle'
        AND public.is_friend_since(auth.uid(), meals.user_id, ms.shared_at)
    )
    OR public.is_active_coach_of(auth.uid(), meals.user_id)
  );

DROP POLICY IF EXISTS "Circle friends can view shared meal items"
  ON public.meal_items;
CREATE POLICY "Circle friends can view shared meal items"
  ON public.meal_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      WHERE m.id = meal_items.meal_id
        AND (
          EXISTS (
            SELECT 1 FROM public.meal_shares ms
            WHERE ms.meal_id = m.id
              AND ms.visibility = 'circle'
              AND public.is_friend_since(auth.uid(), m.user_id, ms.shared_at)
          )
          OR public.is_active_coach_of(auth.uid(), m.user_id)
        )
    )
  );

-- circle_events carries a meal_shared row per share (ref_id = the share id),
-- so its friend branch takes the same bound on the event's own timestamp.
DROP POLICY IF EXISTS "Circle can view actor events" ON public.circle_events;
CREATE POLICY "Circle can view actor events"
  ON public.circle_events FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR public.is_friend_since(auth.uid(), actor_id, created_at)
    OR public.is_active_coach_of(auth.uid(), actor_id)
  );
