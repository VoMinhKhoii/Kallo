---
key: ai-pipeline-cost-breakdown-2026-07
name: Report
task_name: "AI pipeline cost breakdown — post-overhaul (2026-07-18)"
visibility: workspace
priority: normal
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: 9e3846f3-c094-4176-90ff-3e30d8c07d90
---

**Date:** 2026-07-18 · **Author:** Claude (pipeline overhaul, PR #206) · **Source:** staging `pipeline_llm_calls` telemetry (project oudpzhfzirgjbhrzcett) + eval runs

## Per-meal cost — deployed config (v2, gemini-3.1-flash-lite both calls)

Source: last 30 days of staging telemetry, 85 meal requests, 148 LLM calls.

| Metric | Value |
| --- | ---: |
| LLM calls per meal (Call 1 + Call 2 + retries) | 1.74 |
| Input tokens per meal | 6,433 |
| Output tokens per meal | 511 |
| **Cost per meal** | **≈ $0.0032** |
| Cost per 1,000 meals | ≈ $3.21 |
| Cost per 10,000 meals | ≈ $32 |
| Cost per 100,000 meals | ≈ $321 |

Pricing basis: $0.30/1M input, $2.50/1M output (repo `ESTIMATOR_PRICING` — flagged PLACEHOLDER in code; confirm against the live Gemini rate card before using for pricing decisions).

Embeddings (gemini-embedding-001): ~1–4 short texts per meal, dominated by L1/L2/pgvector cache hits after Phase 2 — well under 1% of total cost. Negligible.

Current dogfood burn rate: 85 requests/30 days ≈ **$0.27/month**. Cost is not a constraint at current scale; latency and accuracy are.

## All-time staging telemetry (since 2026-05-12)

| Model | Calls | Requests | In tok | Out tok | avg latency | p90 | errors | retries |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gemini-3.1-flash-lite | 329 | 181 | 1.19M | 129k | 3.6s | 5.8s | 20 | 12 |
| gemini-2.5-flash-lite (legacy, May) | 26 | 17 | 36k | 16k | 4.6s | 10.7s | 6 | 4 |

## A/B outcome — Call-2 model upgrade (2026-07-18 eval, 163-case golden set)

**gemini-3-flash for Call 2 (`next` profile) was REJECTED**: clean-case p50 20.6s / p90 35.6s (vs 7.5s / 12.5s on flash-lite) — fails the p90 < 10s gate by 3.5×; paired accuracy gain was only ~+7pp kcal-in-range, no macro-band gain. **No cost impact — deployed default stays flash-lite.**

## Bakeoff candidates — projected Call-2-only cost per 1k meals

Rough estimates: Call 2 ≈ 3.9k input + 360 output tokens per meal. All pricing from `ESTIMATOR_PRICING` placeholders — confirm before deciding.

| Provider (Call 2) | $/1M in | $/1M out | Call-2 cost / 1k meals | vs gemini |
| --- | ---: | ---: | ---: | ---: |
| gemini flash-class (current) | $0.30 | $2.50 | ≈ $2.07 | 1.0× |
| claude-haiku-4-5 | $1.00 | $5.00 | ≈ $5.70 | ≈ 2.8× |
| gpt-5-mini-class | $0.25 | $2.00 | ≈ $1.70 | ≈ 0.8× |

Even the most expensive candidate lands under $6/1k meals for Call 2 — the bakeoff should be decided on **accuracy** (the eval found flash-lite's weak spots: fat under-estimation on pan-seared dishes, carb under-estimation on rice plates, protein over-estimation on big composed dishes), not cost.

## One-off eval spend today (Vertex, project cal-487315)

Two full 163-case runs (stable + next A/B) + probes ≈ 2.1M input / 165k output tokens ≈ **~$1.05 total**. Local free-tier AI Studio keys cannot sustain full-set runs (500 requests/day/project); eval now runs on Vertex.
