# S01: Database Schema Infrastructure

**Goal:** Define Drizzle ORM table schemas for meals, meal_items, body_weight_log, and unmatched_ingredients, then generate the Supabase migration.
**Demo:** Define Drizzle ORM table schemas for meals, meal_items, body_weight_log, and unmatched_ingredients, then generate the Supabase migration.

## Must-Haves


## Tasks

- [x] **T01: 01-database-schema-infrastructure 01** `est:10min`
  - Define Drizzle ORM table schemas for meals, meal_items, body_weight_log, and unmatched_ingredients, then generate the Supabase migration.

Purpose: Establish the core data structures that all subsequent phases (AI pipeline, meal logging, weight tracking, analytics) build on. Without these tables, no feature can persist data.

Output: Updated `lib/db/schema.ts` with 4 new table exports; one Drizzle-generated migration SQL file in `supabase/migrations/`.
- [x] **T02: 01-database-schema-infrastructure 02** `est:3min`
  - Enable pgvector, add embedding column to vietnamese_food_composition, create HNSW index, build the match_ingredients search function, and generate embeddings for all existing rows.

Purpose: Semantic ingredient matching is the core of the AI pipeline — it handles Vietnamese synonyms (thịt ba chỉ/ba rọi/thịt mỡ), misspellings, and LLM extraction errors via vector similarity instead of exact text matching. Without this, Phase 3 (AI Pipeline) cannot ground its outputs.

Output: One raw SQL migration file (Domain B — not Drizzle-managed) that sets up the complete pgvector infrastructure.
- [x] **T03: 01-database-schema-infrastructure 03** `est:2min`
  - Create RLS policies for all new tables so users can only access their own data.

Purpose: Security boundary enforcement. Without RLS, any authenticated user could read/modify any other user's meals, weight entries, and nutrition data. This is a Supabase requirement for any user-facing table.

Output: One raw SQL migration file (Domain B) with RLS policies for meals, meal_items, body_weight_log, and unmatched_ingredients.

## Files Likely Touched

- `lib/db/schema.ts`
- `supabase/migrations/_add_meals_weight_tables.sql`
- `supabase/migrations/_pgvector_embeddings.sql`
- `supabase/migrations/_rls_new_tables.sql`
