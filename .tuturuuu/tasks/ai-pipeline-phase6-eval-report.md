---
key: ai-pipeline-phase6-eval-report
name: Report
task_name: "AI pipeline overhaul — Phase 6 eval results & A/B verdict (2026-07-18)"
visibility: workspace
priority: high
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: f9cd294d-0d40-4fcb-9b05-142e296f12d1
---

**Date:** 2026-07-18 · **Author:** Claude (orchestrator) + Codex/Claude executors · **Scope:** PR #206 (`feat/pipeline-phase0-telemetry-eval`, phases 0–6) · **Eval:** 163-case golden CI set on Vertex AI (`cal-487315`)

## Executive summary

The v2 pipeline overhaul (phases 0–5) held up under the first full golden-set evaluation. Latency halved, silent zeros are eliminated, staple matching went from 62.5% → 88.9%, and injection hardening held. The gemini-3-flash Call-2 upgrade was **rejected** on latency evidence. The remaining accuracy gap is concentrated in three specific macro clusters that need portion priors and data curation, not a bigger model.

## Headline numbers (stable profile, gemini-3.1-flash-lite)

| Metric | Phase-0 baseline | Now |
| --- | --- | --- |
| Latency p50 / p90 (clean cases) | 12.8s / 24.5s | **7.5s / 12.5s** |
| Silent zero/1g rows | present (prod bug) | **0 / 163 cases** |
| Staple match rate | 62.5% | **88.9%** |
| Non-food rejection | 75% | 80% (4/5; 5th died to a timeout, not a misclassification) |
| Strict pass (kcal + ALL macro bands) | n/a (old set was looser: 35/63) | 85/163 (52%) |
| Kcal in range (clean cases) | — | 67% |
| Macro bands in range (clean) | — | 71% |
| Clarify behavior (vague inputs must ask, not guess) | didn't exist | 8/10 correct |
| Prompt-injection resistance | 0% | held in both adversarial cases |

"Clean cases" excludes 25 runs that died to eval-environment timeouts (Vertex 429s at concurrency 3), not pipeline logic.

## A/B verdict: gemini-3-flash for Call 2 — REJECTED

- Clean-case latency p50 **20.6s** / p90 **35.6s** vs flash-lite's 7.5s / 12.5s — fails the p90 < 10s flip gate by 3.5×; 77/163 cases died to stage deadlines.
- Paired accuracy on the 76 cases clean in both runs: kcal-in-range 58 vs 53 (~+7pp), macro bands 75% vs 76% (no gain).
- **Deployed default stays flash-lite.** If more Call-2 accuracy is wanted, run the provider bakeoff (claude-haiku-4-5 / GPT-5-mini) — decide on accuracy; cost is immaterial (see DEV-85).

## Bugs found by the eval and fixed same-day (both on PR #206)

1. **Locale-tagged portion priors were unreachable in production** (`15153d1`). Nothing populates `userContext.inputLanguage`, so `findPrior` always resolved locale='global' and every vi/en-tagged prior was dead — the "2 bánh bao trứng cút" case had silently regressed to LLM-guessed grams (293 kcal; worse than the original 390 bug). Fix: any-locale fallback (locale is a prior, not a filter — concept × unitType already scope the lookup). E2E verified: 293 → **753 kcal** via `retrieved_prior`. Regression test added.
2. **Ice not classified noncaloric** (`363a7de`). "Cà phê sữa đá" decomposes to a standalone "Đá" ingredient at 0 kcal — correct, but unflagged, so it was indistinguishable from a data failure downstream.

## Data-quality findings (need human curation — see companion task)

- FAO row **"Bánh bao nhân thịt"** (`fao_vn_2007_1009_cooked`): fat 0.5g / protein 6.1g per 100g — plain-dough macros mislabeled as a meat-filled bun. Now the dominant error source on bánh bao cases (portion is fixed; the row is wrong).

## Remaining accuracy gap — three clusters (see companion backlog task)

1. **Fat under-estimated on pan-seared/fried lean dishes** — Call 2 ignores cooking oil ("200g ức gà áp chảo" → 2.9g fat).
2. **Carbs under-estimated on rice plates** — cơm tấm at 55g carbs vs 70–120 expected; rice portions underweighted.
3. **Protein/kcal over-estimated on large composed dishes** — bún thịt nướng at 1024 kcal vs 500–850; partly run variance at temp 0.4.

None of these improved under the bigger model → the fix path is portion priors (oil, cooked-rice bowl) + anomaly clamps, not model spend.

## Eval infrastructure lessons (now encoded in the harness)

- **Free-tier AI Studio cannot run full evals**: 500 requests/day/project + ~10 RPM; a full run needs ~500 calls; 429 backoffs (30–60s) outlive v2 stage deadlines. Eval now runs on **Vertex AI** (project `cal-487315`, ADC, location=global) — a stable+A/B run pair costs ≈ $1.
- Harness fixes that mattered: DB pool warm-up (idle Supabase pooler = ~13s per new connection; wedged entire runs), Bun fires `.unref()`'d timers late (90s ceiling fired at 282–640s), `process.exit` after report (postgres pool kept zombie processes alive for hours, silently burning API quota on retries).

## What's left

1. Khoi merges PR #206, applies the two migrations (pipeline_version, v2_anomaly_causes) via the normal deploy flow → staging Cloud Run telemetry becomes the production-truth validation.
2. FAO row curation (companion task).
3. Portion-prior seeds + provider bakeoff (companion backlog task).

**Artifacts:** golden set `scripts/eval/fixtures/golden-{vn,global}.json` (163 cases, tiered smoke/core/extended, macro bands, specificity-proportional tolerance) · reports in `scripts/eval/reports/` · cost breakdown DEV-85.
