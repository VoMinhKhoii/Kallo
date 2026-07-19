-- =============================================================================
-- Domain B: Database Security & Logic — meal_share_reactions server-only
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Reactions are read and mutated only through server actions on the Drizzle
-- owner connection. RLS is enabled with no client policies, and table grants
-- are revoked from API roles, so PostgREST cannot bypass canViewShare().
-- =============================================================================

ALTER TABLE public.meal_share_reactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.meal_share_reactions FROM anon, authenticated;
