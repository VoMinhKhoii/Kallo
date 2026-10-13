-- =============================================================================
-- Domain B: Database Security & Logic
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Contract step of the food_card_texts move (20261013070517 / 070600):
-- match_food_card_texts has served every deployed revision since #444, so the
-- old search function goes first, then 20261013093015 drops the
-- food_card_vectors table it read (with its indexes and RLS policy). plpgsql
-- bodies are not tracked as dependencies, so the table's CASCADE would leave
-- this function behind.
-- =============================================================================

SET search_path TO public, extensions;

DROP FUNCTION IF EXISTS public.match_food_cards(vector[], integer);
