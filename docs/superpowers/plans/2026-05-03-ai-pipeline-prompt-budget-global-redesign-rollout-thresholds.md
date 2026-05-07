# AI Pipeline Prompt Budget Rollout Thresholds

Purpose: define the go/no-go thresholds that must be filled before any
schema, prompt, dynamic packet, provider, or cache canary changes production
defaults.

This checklist is intentionally separate from the implementation plan so each
canary decision has one durable review surface. Do not enable a canary until
the relevant row has concrete thresholds, a baseline reference, observed
metrics, and a decision owner.

## Baseline References

| Reference | Source |
| --- | --- |
| Current prompt/schema budget | `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-baseline.md` |
| Admin comparison surface | `/admin/requests/[id]` LLM call and stage metadata |
| Shadow comparison path | Existing pipeline shadow-run/admin replay infrastructure |
| Latency benchmark harness | `docs/superpowers/plans/2026-05-08-ai-pipeline-latency-regression.md` and `scripts/benchmark-ai-pipeline-latency.ts` |
| Production env contract | `.env.example` |

## Default State (must be OFF until thresholds filled)

Every canary below ships with the production path as its source-side default. Setting any of these env vars in `.env.local`, `.env`, or any deployed environment counts as "rolling out" — even on a single dev machine — and is the very thing this checklist exists to gate. **Do not flip a default until the corresponding row below has concrete thresholds, observed metrics, and a `go` decision in the Decision Log.**

| Canary | Env var | Source default (unset) | Enable value |
| --- | --- | --- | --- |
| Schema format (slim) | `PIPELINE_PROVIDER_SCHEMA_MODE` | `full` (descriptions kept) | `slim` |
| Decomposition prompt (compressed) | `PIPELINE_DECOMPOSITION_PROMPT_LABEL` | `production` | `compressed` |
| Nutrition prompt (compressed) | `PIPELINE_NUTRITION_PROMPT_LABEL` | `production` | `compressed` |
| Dynamic nutrition facts packet | `PIPELINE_NUTRITION_PACKET_LABEL` (TBD) | `xml` | `compact` (TBD; see Chunk 4) |
| Provider (Vertex) | `AI_PROVIDER` (TBD) | `developer` | `vertex` |
| Vertex context cache | Provider-side config | disabled | enabled per spec |
| Model profile (next) | `PIPELINE_MODEL_PROFILE` | `stable` | `next` |
| Shadow runner | `SHADOW_RUNNER_ENABLED` | unset (off) | `true` |

## Required Decision Fields

Every rollout row must be filled before canary traffic starts:

| Field | Required value |
| --- | --- |
| Variant label | Exact runtime label used in trace/admin metadata |
| Baseline sample | Date/range or replay set used for current behavior |
| Canary sample | Date/range or replay set used for variant behavior |
| Minimum sample size | Request count or replay count required before decision |
| Thresholds | Concrete pass/fail thresholds from the tables below |
| Observed metrics | Actual measured values from admin/shadow traces |
| Decision | `go`, `no-go`, or `needs-more-data` |
| Owner | Person approving the decision |
| Notes | Links to representative traces or anomalies |

## Threshold Checklist

### Schema Format

| Metric | Threshold before canary | Observed | Decision notes |
| --- | --- | --- | --- |
| Schema token/char reduction target | TBD before canary | TBD | Compare full vs slim provider schema |
| Provider parse error ceiling | TBD before canary | TBD | Failed provider JSON/schema parsing |
| Runtime Zod validation failure ceiling | TBD before canary | TBD | Post-provider runtime parse failures |
| p95 model-call latency ceiling | TBD before canary | TBD | Must not regress versus baseline |
| Retry rate ceiling | TBD before canary | TBD | Include provider and schema retries |
| Quality drift review criteria | TBD before canary | TBD | Representative admin trace review |

### Decomposition Prompt

| Metric | Threshold before canary | Observed | Decision notes |
| --- | --- | --- | --- |
| Prompt token/char reduction target | TBD before canary | TBD | Static prompt plus user message budget |
| Provider parse/schema failure ceiling | TBD before canary | TBD | Decomposition response validity |
| Language mismatch rate ceiling | TBD before canary | TBD | Output language vs detected input contract |
| Unmatched ingredient rate drift | TBD before canary | TBD | Compare against baseline/shadow |
| Anomaly rate drift | TBD before canary | TBD | Ambiguity, missing grams, bad item splits |
| Source-distribution drift | TBD before canary | TBD | FAO/USDA/unmatched distribution |
| p95 latency ceiling | TBD before canary | TBD | Decomposition call latency |
| Retry rate ceiling | TBD before canary | TBD | Provider and language-guard retries |

### Nutrition Prompt

| Metric | Threshold before canary | Observed | Decision notes |
| --- | --- | --- | --- |
| Prompt token/char reduction target | TBD before canary | TBD | Static prompt plus dynamic facts |
| Provider parse/schema failure ceiling | TBD before canary | TBD | Nutrition response validity |
| Macro divergence ceiling | TBD before canary | TBD | Calories/protein/carbs/fat vs baseline |
| Anomaly rate drift | TBD before canary | TBD | Out-of-range bounds, missing IDs, bad echoes |
| p95 latency ceiling | TBD before canary | TBD | Nutrition call latency |
| Retry rate ceiling | TBD before canary | TBD | Provider and schema retries |

### Dynamic Nutrition Facts Packet

| Metric | Threshold before canary | Observed | Decision notes |
| --- | --- | --- | --- |
| Dynamic packet token/char reduction target | TBD before canary | TBD | Current XML vs compact packet |
| Provider parse/schema failure ceiling | TBD before canary | TBD | Nutrition response validity |
| Macro divergence ceiling | TBD before canary | TBD | Calories/protein/carbs/fat vs XML baseline |
| ID/name echo failure ceiling | TBD before canary | TBD | Meal/ingredient ID preservation |
| Source-distribution drift | TBD before canary | TBD | Matched source behavior |
| p95 latency ceiling | TBD before canary | TBD | Nutrition call latency |

### Provider: Developer API To Vertex

| Metric | Threshold before canary | Observed | Decision notes |
| --- | --- | --- | --- |
| Provider error rate ceiling | TBD before canary | TBD | 429/5xx/auth/quota categories |
| Retry rate ceiling | TBD before canary | TBD | Distinct provider attempts |
| p95 latency ceiling | TBD before canary | TBD | Stage and provider-call latency |
| Token usage drift | TBD before canary | TBD | Provider-reported input/output tokens |
| Macro divergence ceiling | TBD before canary | TBD | End-to-end nutrition comparison |
| Language mismatch rate ceiling | TBD before canary | TBD | Output-language contract |
| Rollback trigger | TBD before canary | TBD | Env/config flip back to Developer API |

### Vertex Context Cache

| Metric | Threshold before canary | Observed | Decision notes |
| --- | --- | --- | --- |
| Cache hit expectation | TBD before canary | TBD | Explicit cache eligible requests only |
| Cache miss expectation | TBD before canary | TBD | Misses must not fail requests |
| Cached token target | TBD before canary | TBD | Provider-reported cached tokens |
| Cache error ceiling | TBD before canary | TBD | Create/use/delete/permission failures |
| p95 latency ceiling | TBD before canary | TBD | Cached vs uncached Vertex calls |
| Provider error rate ceiling | TBD before canary | TBD | Vertex cache-specific errors |
| Governance confirmation | TBD before canary | TBD | Static-only explicit cache policy reviewed |

## Decision Log

| Date | Variant label | Decision | Owner | Notes |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | Fill after canary comparison |
