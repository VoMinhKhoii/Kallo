# T03: 03-ai-pipeline 03

**Slice:** S03 — **Milestone:** M001

## Description

Build the LLM prompt templates, pipeline orchestrator, and server action that tie everything together. The prompts inject user context (regional profile, cooking habits) into LLM calls. The pipeline orchestrator sequences: LLM decomposition → ingredient matching → LLM nutrition adjustment → goal adjustment → aggregation. The server action handles auth, profile fetch, and error handling.

Purpose: This is the capstone plan — it composes all the foundation from 03-01 (types, schemas, goal-adjustment) and 03-02 (Gemini client, ingredient matching) into the complete meal analysis pipeline. After this plan, the AI engine is functional and can be called from the Phase 4 UI.

Output: Complete `lib/ai/` module with prompts, pipeline, server action, and full test coverage.

## Must-Haves

- [ ] "LLM Call 1 prompt includes user's regional profile and cooking habits to resolve ambiguous inputs"
- [ ] "LLM Call 1 prompt instructs decomposition into user-facing meal items with internal ingredient breakdown"
- [ ] "LLM Call 2 prompt receives DB nutrition per 100g for each matched ingredient plus estimated grams and cooking method"
- [ ] "LLM Call 2 prompt instructs production of low/mid/high bounded estimates adjusted for cooking method, portion, and user habits"
- [ ] "LLM Call 2 prompt receives unmatched ingredients and produces fallback estimates from LLM knowledge"
- [ ] "Pipeline orchestrator calls LLM Call 1 → ingredient matching → LLM Call 2 → goal adjustment in sequence"
- [ ] "Pipeline computes overall meal confidence from individual ingredient confidences"
- [ ] "Pipeline sums bounded nutrition and displayed nutrition across all ingredients for meal total"
- [ ] "Pipeline handles non-food input by returning a PipelineError with type 'non_food_input'"
- [ ] "Pipeline retries once on API errors before returning PipelineError"
- [ ] "Server action validates user is authenticated, fetches user profile, calls pipeline, and returns PipelineResponse"
- [ ] "Server action logs unmatched ingredients to the database after successful pipeline run"
- [ ] "Meal slot classification is included in LLM Call 1 output"
- [ ] "Static assumption text per goal is generated (English only for Phase 3)"

## Files

- `lib/ai/prompts.ts`
- `lib/ai/pipeline.ts`
- `lib/ai/actions.ts`
- `lib/ai/__tests__/pipeline.test.ts`
- `lib/ai/__tests__/prompts.test.ts`
