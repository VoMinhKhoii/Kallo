---
name: verify-before-done
description: |
  Invoke before ANY claim of done / fixed / complete / verified / ready for review — and
  before /ship, pushing, un-drafting a PR, or telling the user "test it now". Green gates
  are not proof the product works: requires CI-equivalent gates, the behavior observed
  once, and a report where every claim points at a tool result.
allowed-tools:
  - Bash
  - Read
  - Skill
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Verify Before Done

In 10 of the last 14 recorded sessions a done-claim went out before anyone had watched
the change work; every one shipped behind green gates. A done-claim needs **both**
altitudes: the gates CI runs, and the behavior observed.

## 1. Gates — exactly what CI runs, from the right root

```bash
git rev-parse --show-toplevel && git branch --show-current   # the worktree, not the main checkout
bunx tsc --noEmit
biome ci .                      # not a scoped `biome check <files>`
bun check:structure             # most-missed gate on record — CI caught it in 4 sessions
bun run test > "$OUT" 2>&1      # FULL suite (`bun test` is Bun's runner and fails here)
# touched supabase/migrations?
node scripts/ci/check-migration-timestamps.js
# mobile (apps/mobile-flutter): flutter analyze && flutter test
```
- Send suite output to a file once and grep the file — it was re-run 4× just to read
  failure names that had gone to `tail` (`f6072383` L2233–2254).
- One heavy toolchain job at a time: a suite run alongside a Flutter agent took 11,040s
  and reported 66 bogus errors (`f6072383` L991–1003).
- Do not push before the result returns. Name only gates whose output you can point to —
  "All gates green (…Biome…)" came from a run with no Biome line; CI failed it
  (`4d52b915` L1156→L1228).

## 2. Behavior — observe it once, by change type

| You changed | Minimum observation |
|---|---|
| Web UI | Render it live; screenshot **and** one programmatic assertion (rects, visibility). Look at the screenshot. |
| Mobile UI | Simulator frame of the changed screen **in the state the fix targets** (keyboard up, short screen). |
| Animation / interaction | The hardest frame — mid-transition, hover active, both ends of a toggle. |
| Server action / API | One real consumer path executed (curl the route, run the screen that calls it). |
| Schema / push / notification path | Migration applied somewhere + one end-to-end pass observed. "complete… grilled" with neither hid 3 defects (`cc03e22b` L389→L1261). |
| Script / CI workflow | Primary path executed once, or the report says "never executed". |

Every new UI surface is rendered once before "ready": four review passes and green gates
shipped a meter whose cells had zero height — only PR screenshots exposed it
(`56cfd62e` L2959, L2967).

## 3. Verify what ships, against what was approved

- **The reference is the approved artifact plus the user's steers — not your own spec.**
  List every element the user approved (canvas, mock, messages, including ones from
  before a compaction) and tick each against a rendered frame. "compared to the canvas" →
  "you forget the scattered meals" → "I dropped both when I wrote the spec"
  (`f3074584` L5067→L5104→L5108).
- **Shipping a subset of the tree? Behavior-verify that subset** — check it out, run it.
  A dependency file stayed behind and it took two "still broke" rounds to find
  (`586b1841` L1934→L2662→L2682).

## 4. A blocked check is reported as blocked — never swapped for a weaker one

Permission denied, daemon down, key missing → the report says
`UNVERIFIED: <path> — <why>` and hands the user the exact command or click-path. The
recorded failure: live check denied → unconfigured path tested instead → "Done… Add the
key and it's live" → every query 403'd (`5182cdc4` L5153→L5162→L5176). Same for context
pressure: verify first, summarize second, or say "shipped unverified due to session
limits" in those words.

## 5. Audit the diff's composition before "ready for review"

```bash
git fetch origin && git diff origin/main --numstat | sort -rn | head -40
git diff origin/main --diff-filter=D --name-only      # every deletion is one you meant
```
Bucket the lines (source / tests / generated / scaffolding / docs); justify each
non-source bucket. "wth why is there 14k lines in the PR?" — 62% was design scaffolding
and one commit had deleted `apps/docs/mobile/` (`56cfd62e` L3105, L3110, L3942). Never
un-draft a PR on the user's behalf.

## 6. Before "test it now" — check the preconditions

Backend up? Can the flow occur on the user's platform? A handed-over script died on the
user's Ruby (`4d52b915` L1846→L1874).

## 7. The evidence-audited report

Audit every claim in the final message against a tool result from THIS session. Format:
what changed → what was verified and HOW (command / screenshot per claim) → what was NOT
verified and why. An explicit "not verified" is fine; an implicit one is the failure.

---

**Status:** rules 1, 2, 6, 7 VALIDATED 2-0 (blind A/B, 2026-07-05, under the 0.1.0
wording — `_evidence/validation/results.md`). Condensed 2026-09-20; rules 3–5 and the
gate-list corrections are round-2, transcript-derived, NOT blind-validated.
Evidence: `_evidence/findings.md` §F1/F2/F4, `_evidence/findings-r2.md` §R1/§R4.
Drift re-check: `grep -n 'biome ci\|check-structure\|tsc --noEmit\|bun run test' .github/workflows/ci.yml`
