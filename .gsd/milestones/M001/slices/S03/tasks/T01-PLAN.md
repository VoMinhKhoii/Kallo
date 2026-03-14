# T01: 03-ai-pipeline 01

**Slice:** S03 — **Milestone:** M001

## Description

Create the foundational data layer for the AI pipeline: remove dead DB columns that were never collected in onboarding, define all pipeline domain types, build Zod schemas for LLM structured output validation, and implement the pure goal-adjustment computation.

Purpose: Every other pipeline component depends on these types and schemas. The goal-adjustment function is the core business logic that transforms bounded estimates into user-facing numbers. By building and testing these pure functions first, we establish a verified foundation before adding Gemini API calls and DB queries.

Output: Migration dropping 4 dead columns + complete `lib/ai/` module foundation with types, schemas, and tested goal-adjustment.

## Must-Haves

- [ ] "fatTrimPork, fatTrimChicken, fatTrimFish, boneAwareness columns and their CHECK constraints are removed from lib/db/schema.ts"
- [ ] "Drizzle migration drops the 4 dead columns and 3 CHECK constraints cleanly"
- [ ] "Goal-adjustment formula matches spec: displayed = mid + aggression × (goal_bound − mid)"
- [ ] "Cutting goal uses pessimistic bounds: high for calories/carbs/fat, low for protein"
- [ ] "Bulking goal uses optimistic bounds: low for calories/carbs/fat, high for protein"
- [ ] "Maintaining goal always returns mid regardless of aggression value"
- [ ] "Aggression 0 (maintaining) collapses formula to mid for all nutrients"
- [ ] "Non-goal-adjusted nutrients (micronutrients) always return mid"
- [ ] "Null bounded estimates produce null displayed values"
- [ ] "LLM Call 1 schema validates decomposition output with ingredient names, grams, cooking methods"
- [ ] "LLM Call 2 schema validates bounded nutrition output with low/mid/high per nutrient"
- [ ] "Zod schemas reject invalid data (negative grams, missing required fields, out-of-range bounds)"

## Files

- `lib/db/schema.ts`
- `supabase/migrations/NEW_drop_dead_cooking_columns.sql`
- `lib/ai/types.ts`
- `lib/ai/schemas.ts`
- `lib/ai/goal-adjustment.ts`
- `lib/ai/__tests__/goal-adjustment.test.ts`
- `lib/ai/__tests__/schemas.test.ts`
