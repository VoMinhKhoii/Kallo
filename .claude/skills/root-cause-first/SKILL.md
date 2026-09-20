---
name: root-cause-first
description: |
  Invoke on ANY unexpected behavior: a test or CI failure, a second identical
  timeout/hang, a third-party API error, a "still broken" / "it still does X" report, or
  an anomaly during your own QA. No second patch until the mechanism is stated from
  something observed; no negative claim from a probe that could not have said yes.
allowed-tools:
  - Bash
  - Read
  - Grep
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Root Cause First

Guessed mechanisms appeared in 7 of the last 14 recorded sessions. The costliest: two
guesses at a payment error, **each costing a production purchase-window cycle**, then
"let me get the actual error text instead of guessing" — solved in one step
(`67ee41da` L5175→L5218).

## 1. Observe the failure before proposing a cause

- **Third-party / API error:** reproduce the failing request and read the error body
  first. Before trusting a probe, run it on a known-negative — "My 400/403 probe was a bad
  oracle" (`67ee41da` L2366). Never test a guess against production.
- **CI failure:** read the failing job's log and reproduce locally before any patch. A
  theory patch was pushed, the same job failed again, and only then did a root-cause
  pass find the real segfault (`4b54de9b` L803→L826→L994). If the cause is external,
  push nothing — no placebo commits.
- **Second identical timeout or hang:** stop retrying with longer timeouts; probe the
  mechanism (CPU%, `GIT_TRACE=1`, what the process is waiting on). Thirteen git timeouts
  across two sessions preceded the actual diagnosis (`5182cdc4` L5417–L6066; `4b54de9b`
  L476–L1476, which also `rm`'d other worktrees' lock files on a guess, L683).

## 2. An anomaly during your own QA is a lead, not noise

You may not blame tooling, flakiness, a stale cache, or the simulator without one direct
check. "Found a real bug… Tailwind v4 didn't emit" was patched into code, then retracted:
a stale dev stylesheet (`586b1841` L1195→L1224). Never carry an unexplained anomaly — or
failures dismissed as "flaky" without their names captured (`f6072383` L2264) — across
a done-claim.

## 3. No second patch on the same symptom without a stated mechanism

Before attempt #2 write one line: `Mechanism: <why #1 failed / why the bug exists>`,
grounded in a log, the source, or a probe. If you cannot, you are guessing — stop and
diagnose. Third fix on the same behavior → the model of the feature is wrong; state what
it does end-to-end and check how established implementations solve it (Context7).

## 4. "Still broken" after "fixed, tests green" → the test is wrong too

Reproduce from a **rendered** frame before touching code, and make the test measure real
rects in the real container — not the constant the code sets. A gauge clamp was "fixed"
twice with green tests while the user still saw it; only the third dispatch demanded
evidence first (`21d1773a` L1343→L1875→L2330→L2380). Do not relay a worker's "already
correct" you have not seen yourself (L2560).

## 5. A negative claim needs a probe that could have returned a positive

"No trigger", "no callers", "only check", "CI is done":
- one SQL statement per probe — MCP `execute_sql` returns only the last; a false P0 was
  announced and retracted on that artifact (`f6072383` L655→L804);
- searches unfiltered and un-`head`ed, with quoted globs (`f6072383` L617→L1934);
- "no checks reported" is not "checks passed" (`21d1773a` L2914→L2946).
Signals that look like regressions but are infra: uniform ~10s eval failures = DB
timeouts / pool exhaustion, not the prompt change (`346d3ece` L418→L491, L1847→L1967).

## 6. Known fix first; new fix into memory the same turn

Before improvising around an infra failure spend 30 seconds on `MEMORY.md`, AGENTS.md
§8 Gotchas, `docs/` (`TASK_BOARD.md` for `ttr`, `apps/docs/mobile/` for Flutter builds).
When you do find a recipe, write it to memory **in that turn** — the costliest
workarounds on record recurred across sessions because nobody did. Never put secrets in
memory or inline a pasted key into commands (`06199779` L415; `67ee41da` L1018).

## 7. Reports end with a falsification test

If you cannot fully confirm from your seat, give the user one concrete disconfirmation
step with the alternative pre-registered ("if it still fails on cellular, that points
back at the signing key"). If the deliverable is a diagnosis, fix nothing unasked.

---

**Status:** rules 2, 3, 6 (known-fix half), 7 VALIDATED 2-0 (blind A/B, 2026-07-05, under
the 0.1.0 wording — `_evidence/validation/results.md`). Condensed 2026-09-20; rules 1,
4, 5 and the memory-write half of 6 are round-2, transcript-derived, NOT blind-validated.
Evidence: `_evidence/findings.md` §F3/§D3, `_evidence/findings-r2.md` §R5/§R7.
Drift re-check: `grep -n 'Gotchas' AGENTS.md && ls docs/TASK_BOARD.md`
