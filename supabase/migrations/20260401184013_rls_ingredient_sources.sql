-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- This migration is managed manually. It contains Supabase-specific features
-- (RLS policies) that have no equivalent in Drizzle's TypeScript schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS: Row Level Security for ingredient_sources
-- This is public reference data — read-only for all users.
-- -----------------------------------------------------------------------------
ALTER TABLE public.ingredient_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ingredient sources"
  ON public.ingredient_sources FOR SELECT
  USING (true);
