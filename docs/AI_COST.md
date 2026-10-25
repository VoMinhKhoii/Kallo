# AI cost: where spend is recorded and how to read it

Every model attempt (Gemini or Claude) writes one row to `analysis_model_budget_events`.
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
| `cached_tokens` | the part of `input_tokens` served from the provider cache (billed ~10%) |
| `cache_write_tokens` | the part of `input_tokens` written to Claude's cache (billed 1.25x input); 0 for Gemini, and 0 on rows before 2026-10-15 |
| `output_tokens` | visible response tokens |
| `thought_tokens` | thinking tokens — billed as output, **not** included in `output_tokens` |
| `cost_usd` | what the attempt cost, priced from `lib/ai/cost/pricing.ts` when the row is written. `NULL` (unknown, never zero) on the reservation row, an attempt that reported no usage, or a model not on the rate card. Rows before 2026-10-15 were backfilled from their tokens at that day's rates |
| `latency_ms` | wall time of that one attempt; `NULL` on reservation rows and rows before 2026-10-15 |
| `fallback_from` | on a Gemini attempt that re-ran a failed Claude call, the Claude model it stood in for. A Claude model run on Gemini because there is no `ANTHROPIC_API_KEY`, or because the call carries an image, is not a fallback and leaves it `NULL` |
| `error_category` | set on failed attempts (retries are separate rows). A failure no provider category fits (a schema slip, a refusal) is `unknown` |

Count model calls with `request_count = 0`: the reservation row is not a call.
Every finished attempt is a row, including one whose provider sent no usage.

Embeddings are not recorded: under 1% of spend (Vertex monitoring, 2026-09).

## Reading it

- The admin dashboard (`admin.kallo.fit`, repo `kallo-aws-analytics`) reads
  these rows through the allowlisted `analytics.v_budget_events` view, which
  Kallo's migrations own.
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
output) with the date it was read, and `attemptCostUsd()`, which prices one
attempt for `cost_usd`. `scripts/bench/ai-cost.sql` repeats the rates
inline — update both together (`pricing.test.ts` fails when they drift). A model
missing from the SQL card prices as `null`, never as zero. A rate change only
affects rows written after it deploys; `cost_usd` on older rows keeps the old
price.

## Costing an eval run

The eval harness does not record token usage. Read a Vertex run's spend from the
Cloud Monitoring metric above, over the run's time window.

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
- **Call 2 never emits kcal** — the server derives it from 4P + 4C + 9F, plus
  the ethanol energy of a matched alcoholic beverage row
  (`lib/ai/pipeline/resolve/macros/alcohol.ts`).
  P/C/F stay required on every ingredient: optional or nullable P/C was tried
  and the model dropped them on unmatched rows (the mì-gói C:0g failure mode).
