# T01: 01-database-schema-infrastructure 01

**Slice:** S01 — **Milestone:** M001

## Description

Define Drizzle ORM table schemas for meals, meal_items, body_weight_log, and unmatched_ingredients, then generate the Supabase migration.

Purpose: Establish the core data structures that all subsequent phases (AI pipeline, meal logging, weight tracking, analytics) build on. Without these tables, no feature can persist data.

Output: Updated `lib/db/schema.ts` with 4 new table exports; one Drizzle-generated migration SQL file in `supabase/migrations/`.

## Must-Haves

- [ ] "A meal record can be inserted with JSONB bounded nutrition data (low/mid/high per macro) and retrieved correctly"
- [ ] "Meal items link to both a parent meal and a food composition row with per-item adjusted nutrition bounds"
- [ ] "A body weight entry can be inserted and queried by user and date, with one-entry-per-day upsert semantics"
- [ ] "Unmatched ingredient queries are logged with context for future DB expansion"

## Files

- `lib/db/schema.ts`
- `supabase/migrations/_add_meals_weight_tables.sql`
