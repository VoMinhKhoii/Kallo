# S03: Ai Pipeline

**Goal:** Create the foundational data layer for the AI pipeline: remove dead DB columns that were never collected in onboarding, define all pipeline domain types, build Zod schemas for LLM structured output validation, and implement the pure goal-adjustment computation.
**Demo:** Create the foundational data layer for the AI pipeline: remove dead DB columns that were never collected in onboarding, define all pipeline domain types, build Zod schemas for LLM structured output validation, and implement the pure goal-adjustment computation.

## Must-Haves


## Tasks

- [ ] **T01: 03-ai-pipeline 01**
  - Create the foundational data layer for the AI pipeline: remove dead DB columns that were never collected in onboarding, define all pipeline domain types, build Zod schemas for LLM structured output validation, and implement the pure goal-adjustment computation.

Purpose: Every other pipeline component depends on these types and schemas. The goal-adjustment function is the core business logic that transforms bounded estimates into user-facing numbers. By building and testing these pure functions first, we establish a verified foundation before adding Gemini API calls and DB queries.

Output: Migration dropping 4 dead columns + complete `lib/ai/` module foundation with types, schemas, and tested goal-adjustment.
- [ ] **T02: 03-ai-pipeline 02**
  - Build the Gemini API client and ingredient matching service. The Gemini client wraps `@google/genai` with retry logic and provides structured output generation (for LLM calls) and embedding generation (for vector search fallback). The ingredient matching service implements the fuzzy → vector → unmatched cascade: first try pg_trgm similarity, then fall back to pgvector cosine similarity, then log as unmatched.

Purpose: These services are the I/O layer of the pipeline — they handle all external calls (Gemini API and database). Plan 03-03 (pipeline orchestrator) will compose these services without knowing their implementation details.

Output: `lib/ai/gemini.ts` and `lib/ai/ingredient-matching.ts` with full unit test coverage.
- [ ] **T03: 03-ai-pipeline 03**
  - Build the LLM prompt templates, pipeline orchestrator, and server action that tie everything together. The prompts inject user context (regional profile, cooking habits) into LLM calls. The pipeline orchestrator sequences: LLM decomposition → ingredient matching → LLM nutrition adjustment → goal adjustment → aggregation. The server action handles auth, profile fetch, and error handling.

Purpose: This is the capstone plan — it composes all the foundation from 03-01 (types, schemas, goal-adjustment) and 03-02 (Gemini client, ingredient matching) into the complete meal analysis pipeline. After this plan, the AI engine is functional and can be called from the Phase 4 UI.

Output: Complete `lib/ai/` module with prompts, pipeline, server action, and full test coverage.

## Files Likely Touched

- `lib/db/schema.ts`
- `supabase/migrations/NEW_drop_dead_cooking_columns.sql`
- `lib/ai/types.ts`
- `lib/ai/schemas.ts`
- `lib/ai/goal-adjustment.ts`
- `lib/ai/__tests__/goal-adjustment.test.ts`
- `lib/ai/__tests__/schemas.test.ts`
- `lib/ai/gemini.ts`
- `lib/ai/ingredient-matching.ts`
- `lib/ai/__tests__/gemini.test.ts`
- `lib/ai/__tests__/ingredient-matching.test.ts`
- `lib/ai/prompts.ts`
- `lib/ai/pipeline.ts`
- `lib/ai/actions.ts`
- `lib/ai/__tests__/pipeline.test.ts`
- `lib/ai/__tests__/prompts.test.ts`
