-- =============================================================================
-- Domain B (hand-authored): RLS for user_blocks + content_reports, the
-- one-time conversion of legacy friendship blocks into user_blocks, and a
-- temporary trigger that keeps converting them during the deploy window.
--
-- The tables themselves are Domain A (drizzle-kit, 20260925120000). This file
-- owns the policies, the backfill and the bridge trigger, and must never be
-- overwritten by `drizzle-kit generate`.
--
-- The app reads and writes both tables only on the Drizzle owner connection,
-- with the actor id taken from the session, and the API-role table grants
-- were already revoked wholesale by 20260825120000_lock_postgrest_data_plane.sql
-- (its default privileges cover tables created after it). The policies below
-- are belt and braces and describe intent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Backfill: friendships.status = 'blocked' → user_blocks
-- -----------------------------------------------------------------------------
-- Before this migration a block was the pair's one friendships row with
-- status 'blocked' — a single, undirected edge that could not say who blocked
-- whom. Each becomes one DIRECTED user_blocks row, blocker = requested_by.
--
-- Caveat, accepted: requested_by is exact only when the block created the
-- edge. When a pending/accepted edge was blocked later, the old upsert kept
-- the original requester, so the backfilled block may be attributed to the
-- other person. Reads are symmetric (either direction hides both people), so
-- visibility is unchanged; only which side may unblock can be wrong, and
-- either person can block again to hold their own row.
--
-- The guard skips a requested_by outside the pair (never written by the app,
-- but a corrupt row must not mint a block between strangers). Then every
-- blocked edge is deleted: blocking now ENDS the friendship, so the backfill
-- leaves the same state a fresh block would.
INSERT INTO public.user_blocks (blocker_id, blocked_id, created_at)
SELECT
  f.requested_by,
  CASE WHEN f.requested_by = f.user_low THEN f.user_high ELSE f.user_low END,
  f.updated_at
FROM public.friendships f
WHERE f.status = 'blocked'
  AND f.requested_by IN (f.user_low, f.user_high)
ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

-- A block also deletes both people's notifications about each other
-- (lib/actions/moderation/blocks.ts): the activity list and the badge read the
-- table with no block rule of their own. user_blocks holds only the rows just
-- backfilled, so this clears exactly the converted pairs.
DELETE FROM public.notifications n
USING public.user_blocks b
WHERE (n.recipient_id = b.blocker_id AND n.actor_ids @> ARRAY[b.blocked_id])
   OR (n.recipient_id = b.blocked_id AND n.actor_ids @> ARRAY[b.blocker_id]);

DELETE FROM public.friendships WHERE status = 'blocked';

-- -----------------------------------------------------------------------------
-- 1b. Rollout bridge: convert blocked edges the OLD revision writes from now on
-- -----------------------------------------------------------------------------
-- TEMPORARY. Prod migrations apply before the new revision is promoted, and
-- the revision still serving in that window blocks by upserting the pair's
-- friendships row to status 'blocked' (which is why the status CHECK keeps
-- the value). Without this trigger such a row, written after the backfill
-- above, would be hidden by nothing (the new reads consult only user_blocks)
-- and could never be lifted (unblock deletes a user_blocks row). The trigger
-- applies the backfill to each one as it is written: the same guarded
-- blocker = requested_by conversion with the same caveat (on an existing edge
-- the old upsert keeps the original requester), the same notification
-- cleanup, and the edge deleted, as a fresh block leaves it.
--
-- Deleting the row from its own AFTER ROW trigger is safe here: the old
-- endpoint's RETURNING was computed before AFTER triggers run, and nothing
-- else in its statement reads the row back.
--
-- Invoker rights, like friendships_set_accepted_at: every friendships write
-- comes from the app's owner connection (the API roles have no table grants
-- since 20260825120000), which is not subject to RLS on user_blocks or
-- notifications.
--
-- FOLLOW-UP, once the new revision is fully promoted (see docs/DATABASE.md,
-- "Retiring friendships.status = 'blocked'"): a migration that drops this
-- trigger and function and removes 'blocked' from friendships_status_check,
-- and a code change deleting the leftover `<> 'blocked'` guards.
CREATE OR REPLACE FUNCTION public.convert_legacy_friendship_block()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  other_id uuid;
BEGIN
  IF NEW.requested_by IN (NEW.user_low, NEW.user_high) THEN
    other_id := CASE WHEN NEW.requested_by = NEW.user_low
                     THEN NEW.user_high ELSE NEW.user_low END;

    INSERT INTO public.user_blocks (blocker_id, blocked_id)
    VALUES (NEW.requested_by, other_id)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

    DELETE FROM public.notifications
    WHERE (recipient_id = NEW.requested_by AND actor_ids @> ARRAY[other_id])
       OR (recipient_id = other_id AND actor_ids @> ARRAY[NEW.requested_by]);
  END IF;

  DELETE FROM public.friendships WHERE id = NEW.id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_legacy_friendship_block() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.convert_legacy_friendship_block()
  FROM anon, authenticated;

CREATE TRIGGER convert_legacy_friendship_block
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW
  WHEN (NEW.status = 'blocked')
  EXECUTE FUNCTION public.convert_legacy_friendship_block();

-- -----------------------------------------------------------------------------
-- 2. user_blocks RLS — a user manages only the blocks they placed
-- -----------------------------------------------------------------------------
-- A user may see, place and lift their own blocks. There is no policy that
-- exposes a row to the person who was blocked: a block must never be
-- observable from the other side.
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blockers can view own blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Blockers can place own blocks"
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Blockers can lift own blocks"
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

-- -----------------------------------------------------------------------------
-- 3. content_reports RLS — a reporter files and reads back their own reports
-- -----------------------------------------------------------------------------
-- No UPDATE and no DELETE policy, deliberately: triage status and resolved_at
-- are set by admins on the server, and a reporter must not be able to
-- withdraw or rewrite a report once filed. The absence of those policies is
-- the enforcement.
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can view own content reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Reporters can file content reports as themselves"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');
