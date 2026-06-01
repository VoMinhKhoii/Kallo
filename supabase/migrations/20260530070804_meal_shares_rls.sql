-- =============================================================================
-- Domain B: Database Security & Logic — meal_shares RLS
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- meal_shares is the opt-in share row. A meal is invisible to friends until an
-- explicit row exists (visibility defaults to 'private'). visibility is a
-- deliberate per-meal opt-in; there is no always-share shortcut.
--
--   INSERT / UPDATE / DELETE — only the actor, and only for a meal the actor
--     actually owns (EXISTS-through-meals on meals.user_id = auth.uid()).
--     This blocks sharing someone else's meal.
--   SELECT — the actor sees all own share rows; a non-actor (accepted friend or
--     active coach of the actor) may see a share row ONLY when it is non-private
--     (visibility <> 'private'), so even the existence/timestamp of a meal the
--     owner kept private never leaks. The meal-level policy
--     (circle_meal_visibility) independently gates the underlying meal's macros.
--
-- Depends on public.is_accepted_friend / public.is_active_coach_of
-- (20260530070801_group_rls_helpers).
-- =============================================================================

ALTER TABLE public.meal_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle can view meal shares"
  ON public.meal_shares FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR (visibility <> 'private' AND public.is_accepted_friend(auth.uid(), actor_id))
    OR (visibility <> 'private' AND public.is_active_coach_of(auth.uid(), actor_id))
  );

CREATE POLICY "Actor can insert shares for own meals"
  ON public.meal_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.meals m
      WHERE m.id = meal_shares.meal_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Actor can update shares for own meals"
  ON public.meal_shares FOR UPDATE
  TO authenticated
  USING (actor_id = auth.uid())
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.meals m
      WHERE m.id = meal_shares.meal_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Actor can delete own shares"
  ON public.meal_shares FOR DELETE
  TO authenticated
  USING (actor_id = auth.uid());
