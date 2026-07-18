---
key: data-curation-banh-bao-row
name: Task
task_name: "Data curation — FAO row 'Bánh bao nhân thịt' has plain-dough macros"
visibility: workspace
priority: high
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: fe0eb6ac-6620-456c-a466-82b911d95016
---

**Found:** 2026-07-18 Phase-6 eval · **Area:** nutrition data (`vietnamese_food_composition`) · **Impact:** every bánh bao meal gets a wrong macro split

## Problem

Row `fao_vn_2007_1009_cooked` — `name_primary: "Bánh bao nhân thịt"`:

| per 100g | current row | plausible meat-filled bun |
| --- | ---: | ---: |
| calories | 219 | 230–280 |
| protein | 6.1g | 8–11g |
| fat | **0.5g** | **5–9g** |
| carbs | 47.5g | 30–40g |

The row is internally consistent (4P+4C+9F ≈ 219) but describes **plain steamed dough**, not a meat-filled bun. With the portion bug now fixed (2 buns → 753 kcal, correct), this row is the dominant remaining error on bánh bao cases: eval shows carbs 157g (band 70–130) and fat 3.9g (band 12–32) for "2 bánh bao trứng cút".

## Why code can't fix it

Four-layer design rule: nutrition rows are authoritative source data — hand-edited values must never masquerade as FAO facts. The concept layer (`lib/ai/portion/concepts.ts`) already points `banh-bao` at this row by name; if the row is corrected or replaced, nothing else needs to change.

## Options

1. Correct the row against the original VN FCT 2007 source (verify whether the source itself lists filled vs plain bun — this may be a mislabel introduced at import).
2. Add a properly-sourced curated row for meat-filled bún bao (marked with its own `source_id`, not FAO) and repoint the concept's `dbRowName`.
3. Check siblings while in there: eval also flagged suspicious hallucination-guard snaps against rows for Rice (fat base 51.7g?!), Beef (fat base 0.3g), Cheese (fat base 2.2g) — worth a spot-audit of the top-50 staple rows' macro splits.

## Acceptance

`bun run eval:smoke` — case `gvn-2-banh-bao-regression` passes all four macro bands (kcal already passes).
