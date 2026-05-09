# Production vs Harness Latency Gap

**Status**: structural analysis — explains why `scripts/benchmark-ai-pipeline-latency.ts` reports a different (lower) latency than real production traffic, and what is and isn't fixable in code.

## Numbers

| Source | Warm p50 | Warm p95 |
| --- | --- | --- |
| Harness (Phase B baseline, 2026-05-08, all-off, n=8 PASS) | 11.7 s | 19.8 s |
| Production traces (user-reported, same input set) | ~30 s | 50 s |
| Gap | +18 s p50 | +30 s p95 |

The gap is **not** a single bug. It's the sum of 4 separate effects.

## What the harness skips

The harness invokes `analyzeMeal(...)` directly without going through `app/api/analyze-meal/route.ts`. That bypasses:

| Production-only step | Cost |
| --- | --- |
| `checkAnalysisGuards` (rate-limit guard) | 10–30 ms |
| `logPipelineStart` (awaited) | 5–30 ms |
| `pendingAnalyses` INSERT (awaited; needed for `analysis_complete` event id) | 10–50 ms |
| SSE `ReadableStream` wrapping + `controller.enqueue` per event | 5–20 ms total |
| `traceContext` plumbing → `withStageLog` writes (4 stages, fire-and-forget but pool-bound) | 0 ms blocking |
| `recordPromptVersion` cold-start cache miss (Phase A.7 Z1: now non-blocking) | 0 ms blocking after fix |
| `logPipelineEnd` (fire-and-forget) | 0 ms blocking |
| `logUnmatchedIngredients` (fire-and-forget) | 0 ms blocking |

**Subtotal**: 30–130 ms blocking. Negligible against the 18 s gap.

## What the harness does NOT replicate (the real cost)

### 1. Cold-start serverless penalty

Vercel hibernates idle Node functions. First request after idle pays:

- V8 isolate startup: ~100–500 ms
- Module load (orchestrator imports a lot — Drizzle, Gemini SDK, prompt builders, embedding-cache warm-up): ~200–1500 ms
- DB pool first-connection negotiation: ~100–500 ms
- Gemini SDK lazy initialization on first call: ~100–300 ms

**Subtotal: 0.5–3 s added to the FIRST request of a cold instance.** Subsequent requests on the same warmed instance pay 0.

The harness runs in a single long-lived Bun process — every request after the first is "warm-instance" by default.

### 2. Multi-instance cache misses (the dominant gap)

L1 (embedding-cache.ts) and L4 (orchestrator.ts) caches are **module-level `Map`s**. They live in the V8 isolate's heap and do not cross instances.

Vercel routing distributes traffic across multiple isolates per region. Effective cache hit rate per request:

```
hit rate ≈ requests_to_same_instance / total_requests
        ≈ 1 / N_concurrent_isolates
```

For a typical low-traffic deployment with 2–4 active isolates, each instance independently warms its own cache. A "warm" user (sending two identical inputs in a row) only gets an L4 cache hit if Vercel happens to route the second request to the same isolate as the first — which it doesn't guarantee.

**Cost when the route hits a cold isolate**:

- L4 MISS → full decomposition LLM call: +7–11 s
- L1+L2 partial MISS on shared ingredients → batch embed: +0.5–1 s
- L0 nutrition cache cold (526 entries, in-memory only): negligible (loaded on demand from `nutrition` table)

**Subtotal: +7–12 s when an L4 hit was expected and didn't materialize.**

### 3. Network egress

The harness runs from the user's local machine. Production runs from Vercel's iad1 region (us-east-1).

| Path | RTT to Gemini (`generativelanguage.googleapis.com`) |
| --- | --- |
| User local (Vietnam → us-central) | 200–400 ms |
| Vercel iad1 → us-central | 30–80 ms |

For non-streaming endpoints this is irrelevant. For **streaming**, every chunk pays one half-RTT. A typical nutrition stream emits 50–100 chunks; cumulative chunk-by-chunk latency on a high-RTT path can be 5–10 s slower than on a low-RTT path.

The harness's local-machine path *should* be slower than production, not faster. **That this is reversed suggests the dominant gap factors are #1 and #2 above, masking #3.**

### 4. Production telemetry pool pressure

Production carries:
- 3 `analysisModelBudgetEvents` writes per request (already fire-and-forget; pool-bound)
- 4 `pipelineStageLogs` writes (`PIPELINE_TRACE_ENABLED=true`)
- 1 `pipelineLlmCalls` + 1 `pipelineLlmCallMetadata` per LLM call (2 LLM calls / request)
- 1 `pipelineRuns` row
- N `unmatchedIngredients` rows

Total: ~12–15 INSERT statements per request, all fire-and-forget. Under traffic spikes the DB pool can fill, queuing fresh inserts behind the queue depth. This shows up as **gradual end-of-request slowdown** as the pool drains, not as a single hot-path block.

**Cost: variable, 0–2 s p95 under load. Zero in the harness (no telemetry plumbing).**

## What is fixable in code

### Already fixed (this session)

- **Z1**: `buildLlmStageTrace` is non-blocking (was awaited cold-start ~30–100 ms)
- **Z4**: slim-schema walker drops `title`/`examples`/`default`/`$schema` (~50–200 token reduction per request)
- **Z5**: per-stage timeouts (decomposition 20 s, nutrition 30 s) — earlier abort on hung decomposition without aborting legitimate slow nutrition

### Doable but out of scope for this branch

1. **External L4 cache** — back the decomposition cache with Redis/Upstash so cache hits survive multi-instance routing.
   - **Win**: turns a cold-isolate L4 MISS into an L4 HIT on a shared external store. Saves 7–11 s on the 50%+ of warm-user requests that get routed to a cold isolate.
   - **Cost**: 1 GET per request (~5–20 ms) + Redis hosting.
2. **External L1 embedding cache** — same pattern for the embedding-cache module.
   - **Win**: avoids batch-embed on shared ingredients across instances. Saves 0.5–1 s.
3. **Warm-up endpoint** — a `/api/_warmup` route that pre-loads orchestrator + matcher + nutrition cache so user-facing requests don't pay first-request module-load cost.
   - **Win**: removes 0.5–3 s cold-start penalty from the first user-visible request.
4. **Explicit Gemini prompt caching** (deferred Phase C7) — separate registry for cached system instructions; saves 30–50% on input token cost AND provider-side processing time on warm requests.
   - **Win**: 1–3 s on nutrition LLM cost. Largest single nutrition-side lever.

### NOT fixable in code

- **Cold-start V8/serverless penalty**: inherent to Vercel's hibernation model. Mitigation: keep at least one isolate warm via cron ping, or upgrade to a non-hibernating runtime.
- **Multi-instance cache divergence**: cannot be solved with module-level Maps. Either accept the miss rate or move caches external (item 1–2 above).
- **High-RTT user-to-Gemini path**: Vercel's iad1 to Gemini's us-central is much closer than user-Vietnam to Gemini-us-central. The harness running locally pays this; production should NOT — and indeed, this factor partially cancels with #2 in some traces. The user's reported 30–50 s likely reflects a specific cold-isolate trace where #2 dominated.

## Reading harness numbers correctly

The harness measures: **what the code path costs when caches are hot, no cold start, no telemetry pressure.**

It is the **lower bound** on what production can be expected to deliver — not the actual production p50.

To set production budgets from harness numbers, **add the architectural floor**:

| Component | Harness p50 | Add for prod | Prod p50 estimate |
| --- | --- | --- | --- |
| Cold-isolate routing fraction × L4 miss cost | 0 | +6–10 s × hit-rate | +3–5 s |
| Cold-start (first-after-idle requests only) | 0 | +1–3 s | amortized: +0.3–1 s |
| Telemetry pool under load | 0 | +0–2 s p95 | +0.5 s p50 |
| Network egress (offsetting — prod is closer) | 0 | -0.5 to -2 s | -1 s |

Net: **+3–5 s on harness p50 → realistic prod p50 ≈ 15–17 s** (vs harness 11.7 s, observed user 30 s).

The user's 30 s is in **Tier 2 territory** of the budget spec (with at most one provider-pressure retry). The 50 s tail is Tier 3 (failure mode — multiple retries OR a cold isolate AND a transient 5xx).

## Recommended next investigation

Run the user-side check on a real production trace:

1. Open `/admin/requests/<id>` for a 30+ s request.
2. Check `cache_hit_l4`, `language_guard_misfire`, `retry_step2_count`, attempt counts.
3. If `cache_hit_l4 = false` on a "second identical input" — confirms multi-instance routing is the dominant gap.
4. If `retry_step2_count > 0` — confirms provider pressure was the gap.
5. If both are `0`/`false` and `nutritionMs > 25 000` — the model itself is unusually slow on that input; consider C7 (prompt cache) or a model swap.

Without that visibility, optimizing further is guesswork.
