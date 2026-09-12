-- =============================================================================
-- Domain B (hand-authored): RLS for day_completion_marks
--
-- The table itself is Domain A (drizzle-kit, 20260912172822). This file owns
-- the policies and must never be overwritten by `drizzle-kit generate`.
--
-- Direct user_id ownership, same shape as body_weight_log (20260228155945).
--
-- No UPDATE and no DELETE policy, deliberately: marking a day complete is
-- one-way by product decision, so the write surface is INSERT-only and the
-- absence of those policies is the enforcement, not application code.
-- =============================================================================

ALTER TABLE public.day_completion_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own day completion marks"
  ON public.day_completion_marks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own day completion marks"
  ON public.day_completion_marks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
