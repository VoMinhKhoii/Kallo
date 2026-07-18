---
key: accuracy-backlog-priors-and-bakeoff
name: Task
task_name: "Accuracy backlog — portion-prior seeds + provider bakeoff (3 macro clusters)"
visibility: workspace
priority: normal
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: fee8cd2a-8951-423f-99e7-23b113286e0b
---

**Source:** Phase-6 eval (2026-07-18), 163-case golden set · **Context:** these clusters did NOT improve under gemini-3-flash — model spend is not the fix

## Cluster 1 — Fat under-estimated on pan-seared/fried lean dishes

Evidence: "200g ức gà áp chảo" → 2.9g fat (band 6–20); fitness meal-prep → 2.0g (band 4–13). Call 2 prices the raw ingredient and ignores the cooking fat.

Proposed fix: an **oil prior keyed on cooking method** in the portion layer — when `cookingMethod` ∈ {áp chảo, chiên, xào, pan-seared, fried, sautéed, stir-fried} and no explicit oil ingredient exists, inject a bounded oil quantity (e.g. 5–10g per dish, scaled by user `oilUsage` habit which already exists in `UserContext.cookingHabits`). Server-side, prior-provenance, no model change.

## Cluster 2 — Carbs under-estimated on rice plates

Evidence: cơm tấm → 55g carbs (band 70–120); repeated across rice-plate cases. Cooked-rice portions underweighted by Call 2's LLM range.

Proposed fix: **cooked-rice portion priors** for bowl/plate units (chén ~150–200g, đĩa/plate ~200–300g cooked; scale by `defaultRicePortion` habit). Concept `cooked-rice` already exists in `lib/ai/portion/concepts.ts` — needs count/volume priors seeded in `priors.ts`.

## Cluster 3 — Protein/kcal over-estimated on large composed dishes

Evidence: bún thịt nướng → 1024 kcal (band 500–850), protein 49.5g (band 22–45); bún bò Huế protein varies 8–63g run-to-run (temp 0.4 variance).

Proposed fix: extend the v2 anomaly layer (already classifies causes) to clamp protein against matched-row anchors for accepted candidates; consider temp 0.2 for Call 2 A/B (variance vs adaptability trade).

## Provider bakeoff (when ready)

Stubs are wired (`--estimator claude|openai` in `scripts/eval/run-eval.ts`); need `@anthropic-ai/sdk` + API keys. Models: `claude-haiku-4-5`, gpt-5-mini-class. **Decide on accuracy against these three clusters** — cost is immaterial at our scale (see DEV-85: worst case ≈ $5.7/1k meals for Call 2). Gate any adoption on the same p90 < 10s latency bar that rejected gemini-3-flash.

## Measurement

Each fix lands with `bun run eval:core` before/after on the cluster's tagged cases; golden set grows incrementally as user corrections graduate to `user-corrected` provenance.
