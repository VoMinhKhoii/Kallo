# Pipeline Latency Budget

**Status**: calibrated against a partial Phase B baseline (2026-05-08, `n=10 PASS` on the `all-off` variant only — the rest of the matrix is blocked on Gemini free-tier quota). Numbers were widened where observed reality exceeded the original guess; the rest stand. Re-calibrate once the missing variants (`slim-schema-only`, `compressed-decomposition-only`, `compressed-nutrition-only`, `all-compressed`) are measured.

## Why

Three production traces on the same English meal input produced wildly different latencies (34227 ms, 39694 ms, 15620 ms) because three different stages took the lead in three different runs. The pipeline is multi-class and a single per-request budget hides that. This doc carves the budget into **per-stage** and **per-class** ceilings so future regressions can be detected without inspecting individual traces.

## How latency is measured

Each request emits a structured `[pipeline] metrics` line at end of run (`lib/ai/pipeline/orchestrator.ts:262`) plus a `pipeline_runs` DB row when tracing is enabled. The harness (`scripts/benchmark-ai-pipeline-latency.ts`) consumes these to compute aggregate p50 / p95 across N runs per variant.

Stage timings (ms):

| Field | Source | Definition |
| --- | --- | --- |
| `decomposeMs` | `[pipeline] metrics` | Wall clock from prompt build through L4 cache write (cold path) or L4 lookup (warm path). Includes language-guard retry. |
| `matchMs` | `[pipeline] metrics` | Phase 1-3b of `lib/ai/matching/cascade.ts`. Includes batch embedding, vector search, alias fallback. |
| `nutritionMs` | `[pipeline] metrics` | Wall clock from prompt build through final stream-flush of nutrition LLM call. Includes anomaly retry. |
| `assemblyMs` | `[pipeline] metrics` | Local computation, `assembleResult`. |
| `totalMs` | `[pipeline] metrics` | End-to-end `analyzeMeal` duration. |

Substage signals (booleans / counters in `pipeline_runs`):

| Column | Definition |
| --- | --- |
| `cache_hit_l4` | True if decomposition came from in-memory L4 cache. |
| `language_guard_misfire` | True iff at least one language-guard retry fired. |
| `language_retry_count` | How many language-guard retries ran (≥1 of these) — stored separately so we can trend the rate over time. |
| `retry_step2_count` | Nutrition anomaly retries. |
| `escalated` | Nutrition retry used the escalation model. |
| `alias_fallback_fired` | Phase 3b alias fallback executed (regardless of rescue outcome). |

Per-attempt LLM signals (now visible in console):

- `[gemini] {model}-stream attempt N/M: ttft=Xms` — first-chunk latency
- `[gemini] {model}-stream attempt N/M: Yms` — total stream duration
- `[pipeline] L4 HIT|MISS|STORE` — decomposition cache visibility
- `[embedding-cache] L1 HIT | L2 HIT | L1+L2 MISS` — embedding cache visibility

## Budget tiers

Two tiers because **transient Gemini 5xx retries** are real and unavoidable; we don't want CI to fail on a one-off provider-pressure event but we do want it to fail on a sustained regression.

### Tier 1 — Healthy run (no provider-pressure retry)

Tagged when `pipeline_runs.retry_step2_count = 0` AND no `analysis_model_budget_events` row with `error_category IN ('rate_limit', 'server_error', 'timeout')` for the request.

| Stage | p50 ≤ | p95 ≤ | Phase B observed (2026-05-08) |
| --- | --- | --- | --- |
| `decomposeMs` (cold) | 8000 | 12000 | p50 7911 / p95 10707 (n=2) |
| `decomposeMs` (L4 HIT) | 50 | 200 | p50 1 / p95 5 (n=8) |
| `matchMs` | 1100 | 2200 | p50 1029 / p95 2163 (n=10) |
| `nutritionMs` (warm) | 12000 | 20000 | p50 10676 / p95 19112 (n=8) |
| `nutritionMs` (cold) | 18000 | 25000 | p50 22926 / p95 24377 (n=2) |
| `assemblyMs` | 200 | 500 | not measured directly (≤ 5 ms in metrics line) |
| **`totalMs` (cold)** | **30000** | **38000** | p50 34370 / p95 34455 (n=2) |
| **`totalMs` (L4 HIT)** | **13000** | **22000** | p50 11708 / p95 19775 (n=8) |

> **Calibration note (2026-05-08)**: Original Tier 1 guesses for `nutritionMs` (p50 ≤ 6 s, p95 ≤ 10 s) and `totalMs` (≤ 12 s p50, ≤ 18 s p95 cold) were ~2× too tight against `gemini-2.5-flash-lite` streaming reality. The widened ceilings are framed as "first-release acceptable" rather than "ideal" — they should narrow once a nutrition-side cost lever (smaller schema, prompt cache, or model swap) lands.

### Tier 2 — One provider-pressure retry tolerated

Tagged when at most one `analysis_model_budget_events` row exists with `error_category IN ('server_error', 'rate_limit')` for the request.

| Stage | p50 ≤ | p95 ≤ |
| --- | --- | --- |
| `decomposeMs` | 14000 | 18000 |
| `nutritionMs` | 14000 | 18000 |
| **`totalMs`** | **16000** | **22000** |

### Tier 3 — Failure mode (out of budget)

Anything outside Tier 2 is a failure. Either:
- Multiple retries fired (provider is degraded → page on-call, not a code regression).
- A single stage exceeded its Tier 2 ceiling (genuine code regression → bisect commit history against the last passing harness run).

## Substage fire-rate ceilings

| Signal | Healthy ≤ | Notes |
| --- | --- | --- |
| `language_guard_misfire` rate | 1 % | After Phase C1 prompt strengthening. Above this rate, treat the prompt as regressed. |
| `retry_step2_count > 0` rate | 5 % | Existing target. |
| `escalated = true` rate | 2 % | Escalation model is more expensive; should be rare. |
| `alias_fallback_fired = true` rate | 10 % | Phase 3b is the safety net; above 10 % means the canonical-name vocabulary has gaps. |
| `cache_hit_l4 = true` rate (warm pool) | 30 % minimum | Below this, the cache key is too volatile or the in-memory map is being reset by hot-reload. |

## CI assertion (skeleton)

The harness already emits a JSON output. To enforce the budgets in CI:

```bash
bun scripts/benchmark-ai-pipeline-latency.ts \
  --variant=all \
  --runs=10 \
  --output=docs/superpowers/plans/latency-branch.json \
  --assert=docs/superpowers/specs/2026-05-08-pipeline-latency-budget.md
```

The `--assert` flag is **TODO** — block on a Phase B baseline run before wiring in CI. Without a real baseline the assertion would fire on synthetic data with no signal.

## Observability

Every individual request that breaches its tier should surface a "budget breach" badge on the admin request page (`app/[locale]/(app)/admin/requests/[id]`). Reuses the existing `stage-timeline.tsx` component which already shows per-stage durations. The badge should be **per-stage** so engineers can see at a glance whether decomposition, matching, or nutrition was the offender.

This UI hook is **TODO** — pairs with the harness `--assert` flag.

## Update history

- **2026-05-08**: First draft. Budgets are educated guesses derived from the audit map — they exist to be sharpened by Phase B harness data, not enshrined as gospel.
- **2026-05-08 (later)**: Calibrated against partial Phase B baseline (`n=10 PASS` on `all-off`). Widened `nutritionMs` warm/cold and `totalMs` warm/cold to fit `gemini-2.5-flash-lite` streaming reality. `decomposeMs` cold/warm and `matchMs` retained (within or at observed limits). Substage fire-rate ceilings unchanged — observed 0% across all signals.
