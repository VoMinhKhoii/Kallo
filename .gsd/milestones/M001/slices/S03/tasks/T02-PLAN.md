# T02: 03-ai-pipeline 02

**Slice:** S03 — **Milestone:** M001

## Description

Build the Gemini API client and ingredient matching service. The Gemini client wraps `@google/genai` with retry logic and provides structured output generation (for LLM calls) and embedding generation (for vector search fallback). The ingredient matching service implements the fuzzy → vector → unmatched cascade: first try pg_trgm similarity, then fall back to pgvector cosine similarity, then log as unmatched.

Purpose: These services are the I/O layer of the pipeline — they handle all external calls (Gemini API and database). Plan 03-03 (pipeline orchestrator) will compose these services without knowing their implementation details.

Output: `lib/ai/gemini.ts` and `lib/ai/ingredient-matching.ts` with full unit test coverage.

## Must-Haves

- [ ] "GeminiClient wraps @google/genai with retry logic for 429 rate limits"
- [ ] "generateStructuredOutput accepts a Zod schema, passes toJSONSchema() to Gemini, and parses response back through the schema"
- [ ] "generateEmbedding uses gemini-embedding-001 model with 768 dimensions"
- [ ] "matchIngredients calls fuzzy_match_ingredients first (pg_trgm, threshold 0.15)"
- [ ] "If fuzzy match fails, matchIngredients generates embedding and calls match_ingredients (pgvector, threshold 0.5)"
- [ ] "If both searches fail, ingredient is returned as unmatched"
- [ ] "Confidence classification: HIGH ≥ 0.6, MEDIUM ≥ 0.3, LOW < 0.3"
- [ ] "fetchNutritionPer100g returns all 28 nutrient values from vietnamese_food_composition"
- [ ] "logUnmatchedIngredients inserts into unmatched_ingredients table"
- [ ] "Retry logic handles Gemini 429 responses by parsing delay from error message"

## Files

- `lib/ai/gemini.ts`
- `lib/ai/ingredient-matching.ts`
- `lib/ai/__tests__/gemini.test.ts`
- `lib/ai/__tests__/ingredient-matching.test.ts`
