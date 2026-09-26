# AI cost: where spend is recorded and how to read it

Every Gemini attempt we pay for writes one row to `analysis_model_budget_events`.
The table is always on in prod (`ANALYSIS_BUDGET_EVENTS_ENABLED=false` silences
it) and is the source of truth for spend. `pipeline_llm_calls` and
`pipeline_llm_call_metadata` carry the same counts plus the prompt text, but only
when `PIPELINE_TRACE_ENABLED=true`.

## What a row holds

| Column | Meaning |
|---|---|
| `route` | `/api/analyze-meal` (text meals), `/api/analyze-meal#cheat`, `nutrition-label-ocr` |
| `request_id` | the analysis request; `null` for label OCR |
| `request_count` | `1` on the one reservation row per analysis (no tokens), `0` on every attempt row |
| `input_tokens` | prompt tokens, cached ones included |
| `cached_tokens` | the part of `input_tokens` served from Gemini's cache (billed ~10%) |
| `output_tokens` | visible response tokens |
| `thought_tokens` | thinking tokens — billed as output, **not** included in `output_tokens` |
| `error_category` | set on failed attempts (retries are separate rows) |

Embeddings are not recorded: under 1% of spend (Vertex monitoring, 2026-09).

## Reading it

- `scripts/bench/ai-cost.sql` — daily spend by route/model, cost per analysis,
  cache hit rate and thinking share. Read-only; run it with `psql` against the
  target project.
- Cost per **saved** meal: `meals.pipeline_request_id` is copied from the staged
  analysis at confirm, so `meals ⨝ analysis_model_budget_events` on
  `request_id` works. `pipeline_requests` is reaped after 7 days and the FK is
  `ON DELETE SET NULL`, so the join only covers the last 7 days.
- Vertex totals (to cross-check the table): Cloud Monitoring metric
  `aiplatform.googleapis.com/publisher/online_serving/token_count`, grouped by
  `model_user_id` and `type`.

## Rates

`lib/ai/cost/pricing.ts` holds the per-model rate card (input, cached input,
output) with the date it was read, and `costUsd()`. `scripts/bench/ai-cost.sql`
repeats the rates inline — update both together. A model missing from the card
prices as `null`, never as zero.

## Evals report cost

`scripts/eval/run-eval.ts` counts every attempt per case (Call 1, Call 2,
retries, chunks) and prints a **Cost** section: calls, input / cached / output /
thinking tokens per case, and observed USD per 1k meals.

**AI Studio undercounts input.** Its `promptTokenCount` leaves out the response
JSON schema; Vertex (prod) bills it. Measured 2026-09-25 on
`gemini-3.1-flash-lite`: the Call-1 schema adds 1,733 prompt tokens on Vertex
(full mode) and 803 in slim mode. An eval run on AI Studio therefore reads
~2.6k input tokens per meal low, and schema-size changes do not show in it at
all — run cost comparisons on Vertex.

## Prompt budget decisions (2026-09-26)

Validated on the Vertex golden set (core tier) against a same-day baseline:

- **Slim provider schema is the default** (`lib/ai/prompts/schema.ts`). The
  response schema is billed as prompt tokens on Vertex; slim drops the
  unenforced descriptions and runtime ids. `PIPELINE_PROVIDER_SCHEMA_MODE=full`
  rolls back.
- **Call 1 example JSON renders on one line** (`oneLineExampleOutputs` in
  `lib/ai/prompts/text/decomposition-v2.ts`) — source stays pretty.
- **Call 1 per-user blocks render after the examples**, so every user of a
  locale shares the cacheable prefix.
- **Call 2 never emits kcal** — the server derives it from 4P + 4C + 9F.
  P/C/F stay required on every ingredient: optional or nullable P/C was tried
  and the model dropped them on unmatched rows (the mì-gói C:0g failure mode).
