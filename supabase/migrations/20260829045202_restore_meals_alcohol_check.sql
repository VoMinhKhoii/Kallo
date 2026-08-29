-- =============================================================================
-- Domain B: Database Security & Logic — restore meals.alcohol_g check
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Production audit finding: `meals_alcohol_g_non_negative_check` is defined in
-- lib/infra/db/schema.ts and was applied by 20260601090000_add_cheat_meal_
-- columns.sql, but is absent from production (likely dropped by one of the
-- three orphaned, since-reverted migration-history entries whose SQL is not
-- recoverable). Zero rows violate it today (no non-null alcohol_g values), so
-- re-adding validates trivially. Guarded because the ledger is append-only and
-- non-prod databases that never lost it must replay this migration cleanly.
-- =============================================================================

SET search_path TO public, extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meals_alcohol_g_non_negative_check'
  ) THEN
    ALTER TABLE public.meals
      ADD CONSTRAINT meals_alcohol_g_non_negative_check
      CHECK (alcohol_g IS NULL OR alcohol_g >= 0);
  END IF;
END $$;
