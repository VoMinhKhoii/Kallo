-- =============================================================================
-- Domain B: Database Security & Logic — coach_assignments + circle_events RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- coach_assignments (schema-only / UI dark in the MVP):
--   SELECT visible to the two parties only (coach and client). No INSERT /
--   UPDATE / DELETE policies are wired — with RLS enabled and no write policy,
--   client roles cannot write; only service_role (which bypasses RLS) can seed
--   rows later when the coach console ships.
--
-- circle_events (event spine consumed via polling):
--   SELECT where the viewer is the actor, OR an accepted friend of the actor,
--   OR an active coach of the actor. No client write policy — rows are written
--   exclusively by the SECURITY DEFINER fanout trigger (circle_events_fanout).
--
-- Depends on public.is_accepted_friend / public.is_active_coach_of
-- (20260530070801_group_rls_helpers).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- coach_assignments
-- -----------------------------------------------------------------------------
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach and client can view their assignment"
  ON public.coach_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() IN (coach_id, client_id));

-- -----------------------------------------------------------------------------
-- circle_events
-- -----------------------------------------------------------------------------
ALTER TABLE public.circle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle can view actor events"
  ON public.circle_events FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR public.is_accepted_friend(auth.uid(), actor_id)
    OR public.is_active_coach_of(auth.uid(), actor_id)
  );
