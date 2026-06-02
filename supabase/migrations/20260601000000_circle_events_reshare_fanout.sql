-- =============================================================================
-- Domain B: Database Security & Logic — circle_events fanout on RE-SHARE
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- The original fanout trigger (20260530070807) fired AFTER INSERT only. But
-- un-sharing then re-sharing a meal is an UPDATE (setMealShareVisibility upserts
-- on the per-meal unique key), so a private -> circle transition emitted no
-- 'meal_shared' event. This re-creates the function + trigger to also fire on
-- the private -> non-private UPDATE transition, exactly once, so the event spine
-- stays correct once it gains a consumer.
--
-- Idempotency: an INSERT emits when the new row is shared; an UPDATE emits ONLY
-- on the private -> non-private edge (OLD private, NEW not private), so an
-- already-shared row updated for any other reason (e.g. a sharedAt bump while
-- staying 'circle') does not double-fire, and un-sharing (-> private) is silent.
--
-- Still SECURITY DEFINER with a pinned search_path; clients have no INSERT
-- policy on circle_events.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_meal_share_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.visibility <> 'private' THEN
      INSERT INTO public.circle_events (actor_id, audience, type, ref_id, created_at)
      VALUES (NEW.actor_id, NULL, 'meal_shared', NEW.id, now());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.visibility = 'private' AND NEW.visibility <> 'private' THEN
      INSERT INTO public.circle_events (actor_id, audience, type, ref_id, created_at)
      VALUES (NEW.actor_id, NULL, 'meal_shared', NEW.id, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_meal_share_inserted ON public.meal_shares;

CREATE TRIGGER on_meal_share_changed
  AFTER INSERT OR UPDATE ON public.meal_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meal_share_event();
