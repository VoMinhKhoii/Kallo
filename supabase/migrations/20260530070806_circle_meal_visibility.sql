-- =============================================================================
-- Domain B: Database Security & Logic — additive circle meal visibility
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- ADDITIVE ONLY. The existing owner-only SELECT policies are NEVER modified:
--   meals      — "Users can view own meals"      USING (auth.uid() = user_id)
--   meal_items — "Users can view own meal items" (EXISTS-through-meals)
-- both defined in 20260228155945 and left fully intact. Postgres ORs multiple
-- permissive SELECT policies together, so these new policies only ADD rows a
-- viewer may see; they can never subtract from owner access.
--
-- A peer sees a meal ONLY with BOTH (a) an accepted friendship AND (b) an
-- explicit 'circle' meal_shares row — opt-in to exposure. An active coach sees
-- an assigned client's meals via the dormant OR-branch. body_weight_log gets
-- NO new policy and stays auth.uid() = user_id forever.
--
-- The meal_items policy nests the SAME visibility predicate INSIDE the
-- EXISTS-through-meals, so an item is never visible ahead of its parent meal.
--
-- Depends on public.is_accepted_friend / public.is_active_coach_of
-- (20260530070801_group_rls_helpers).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- meals — additive SELECT for circle friends + active coaches
-- -----------------------------------------------------------------------------
CREATE POLICY "Circle friends can view shared meals"
  ON public.meals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meal_shares ms
      WHERE ms.meal_id = meals.id
        AND ms.visibility = 'circle'
        AND public.is_accepted_friend(auth.uid(), meals.user_id)
    )
    OR public.is_active_coach_of(auth.uid(), meals.user_id)
  );

-- -----------------------------------------------------------------------------
-- meal_items — mirror, with the visibility gate INSIDE the EXISTS-through-meals
-- -----------------------------------------------------------------------------
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
              AND public.is_accepted_friend(auth.uid(), m.user_id)
          )
          OR public.is_active_coach_of(auth.uid(), m.user_id)
        )
    )
  );
