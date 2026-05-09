# AI Pipeline Prompt Budget Baseline

Date captured: 2026-05-07

Purpose: baseline the current prompt/schema budget before compact IDs,
language work, provider adapters, prompt compression, cache changes, or prompt
content changes. This file is a comparison point for later canaries.

## Runtime Defaults

- Provider path: Gemini Developer API via `@google/genai` in `lib/ai/gemini.ts`.
- Default model profile: `STABLE_PROFILE` from `lib/ai/pipeline/model-profile.ts`.
- Decomposition model: `gemini-2.5-flash-lite`.
- Nutrition model: `gemini-2.5-flash-lite`.
- Escalation model: `null` in the stable profile.
- Next profile exists behind `PIPELINE_MODEL_PROFILE=next` but is not the default.

## Prompt And Schema Sources

- Decomposition prompt builder: `lib/ai/prompts/decomposition.ts`.
- Nutrition prompt builder: `lib/ai/prompts/nutrition.ts`.
- Decomposition schema: `mealDecompositionSchema` in `lib/ai/pipeline/schemas.ts`.
- Nutrition schema: `nutritionAdjustmentSchema` in `lib/ai/pipeline/schemas.ts`.
- JSON Schema conversion: Zod 4 `toJSONSchema()`.
- Budget helper: `measurePromptBudget()` in `lib/ai/prompts/budget.ts`.

Measurement formula:

```ts
systemChars = systemPrompt.length;
userChars = userMessage.length;
schemaChars = JSON.stringify(toJSONSchema(schema)).length;
approxTokens = Math.ceil((systemChars + userChars + schemaChars) / 4);
```

## Representative Fixture

The deterministic fixture is a small Vietnamese lunch-style meal with two meal
items and three DB-matched ingredients. It uses a non-sensitive synthetic
input, a Vietnam/Vietnam cooking context, normal oil and sugar-braised habits,
medium rice/protein defaults, and some broth consumption.

The Call 2 fixture includes cooked rice, braised pork belly, and egg reference
rows with synthetic food-composition IDs. No environment values, user IDs, or
real user data are included.

## Measured Baseline

| LLM call | System chars | User chars | Schema chars | Approx tokens |
| --- | ---: | ---: | ---: | ---: |
| Decomposition | 10,701 | 24 | 2,736 | 3,366 |
| Nutrition | 4,872 | 111 | 3,013 | 1,999 |

Notes:

- `promptChars` persisted in trace metadata is `systemChars + userChars`.
- `schemaChars` persisted in trace metadata is the serialized Zod JSON Schema
  size.
- `approxTokens` is provider-neutral and is not persisted in the database.
- Current nutrition dynamic ingredient/reference data is embedded in the
  system prompt returned by `buildNutritionPrompt()`; `userChars` only counts
  the separate Gemini user message.

## Available Token And Budget Metadata

Current traced streaming LLM calls persist:

- Base `pipeline_llm_calls.input_tokens` and `output_tokens` from Gemini usage
  metadata when the provider returns them.
- `pipeline_llm_call_metadata.prompt_chars` and `schema_chars` from the budget
  helper before the provider call.

The metadata table also has nullable placeholders for provider, region,
cache status, metadata-level input/output tokens, cached tokens, and thought
tokens. Task 1.8 does not populate those fields unless future provider/cache
work supplies them.

Admin request details already render non-null metadata chips, including Prompt
and Schema character counts, next to the existing base token display.