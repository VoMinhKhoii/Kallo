-- =============================================================================
-- Domain B: Database Security & Logic — circle_events fanout trigger
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- AFTER INSERT on meal_shares: when the new row is shared (visibility <>
-- 'private'), write exactly one circle_events row so the polling event spine
-- picks it up. A 'private' insert writes nothing. Fanout stays server-side —
-- clients have no INSERT policy on circle_events.
--
-- The trigger function is SECURITY DEFINER with a pinned search_path (same safe
-- pattern as handle_new_user in 20260224100032), so it can write circle_events
-- regardless of the inserting user's RLS without opening a mutable-search-path
-- privilege-escalation vector.
--
-- audience is left NULL (the reserved cohort/group_id seam). ref_id points at
-- the meal_shares row (NEW.id).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_meal_share_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility <> 'private' THEN
    INSERT INTO public.circle_events (actor_id, audience, type, ref_id, created_at)
    VALUES (NEW.actor_id, NULL, 'meal_shared', NEW.id, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_meal_share_inserted
  AFTER INSERT ON public.meal_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meal_share_event();
