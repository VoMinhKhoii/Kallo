---
name: grill-your-own-work
description: |
  Adversarial closer — invoke AFTER work is "complete and verified" and BEFORE saying
  done, /ship, or opening a PR, on any diff spanning 2+ files or platforms; also when
  asked to "grill", "audit", "self grill" or "adversarially review" anyone's work.
  Fresh gates, mandate-vs-reality, the design as well as the diff, suspicion-driven
  probes, REPORT-ONLY reviewers, a graded verdict.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Grill Your Own Work

Run it on your own finished work exactly as you would on someone else's. On record it
found nine migrations that existed in no repo (`5182cdc4` L5953), a "decorative" DB gate
that silently skipped and a P1 letting one account burn the global OCR budget
(`4b54de9b` L616, L1527). Where it was skipped, "Done" was followed by a P0, a P1 and a
browser infinite loop found by others (`82d805ca` L1117→L1291→L1456). Judge size by
`git diff --stat`, never by your edit count.

## 1. Fresh gates first — before re-reading the diff
Run the verify-before-done §1 gate list now, from the right root. Build-phase results
are stale. Add any cheap invariant you can script on the spot (locale-key parity,
`schema_migrations` vs `supabase/migrations/` files).

## 2. Mandate vs reality
Re-read the ORIGINAL ask and every later steer. List each promised behavior and check
it exists. The worst misses on record are structural, not subtle: a widget never ported
under a full-parity mandate (`932ee514` L1371); approved design elements dropped from
the spec (`f3074584` L5108).

## 3. Grill the design, not only the diff
Read the design doc / spec / state machine and attack it: lifecycle, concurrency, failure
modes, what happens on retry. Two diff-scoped reviewers found 2 issues where a
design-level pass then found 17 (`cc03e22b` L306 vs L447, L635). For anything touching
security, billing or RLS, a single in-house reviewer is not a closer — "no server-side
bypasses" was contradicted by the next independent pass (`f6072383` L303→L533).

## 4. Suspicion-driven probes
List the 3–6 places you'd bet a bug hides — cross-layer contracts, cache/query keys,
state after mutation, auth boundaries, gates that can skip — and probe each directly:
trace a key end-to-end, grep both sides of a contract, run one real request, compare the
doc-comment to the implementation.

## 5. Pre-existing or introduced?
```bash
git show origin/main:<file> | grep -n <suspect>
```
Attribute correctly; report pre-existing defects separately, do not fix them here.
"Failures are the user's WIP" needs a base-branch run, not `git status`
(`f3074584` L5794).

## 6. Reviewers are REPORT-ONLY — and so is the grill
Every reviewer prompt contains **"REPORT ONLY. DO NOT EDIT ANY FILES."** Fixing happens
after the verdict, deliberately — one grill applied migrations and code fixes mid-pass
and blurred what it had and hadn't reviewed (`5182cdc4` L5770).

## 7. Self-verify the headline before reporting it
Reproduce your worst finding yourself. Re-verify reviewer and fix-agent claims — grep
for what they say they removed, run what they say passes; prove a regression test by
reintroducing the bug (`56cfd62e` L2322). Reject findings that don't hold
(`f6072383` L545).

## 8. Verdict
Severity-ordered, worst first · graded, not binary ("yes-with-fixes — not yet at your
bar") · a "Non-issues verified" section · "need your decision" for human calls · fix
designs prescribed for the tricky ones, then re-run §1.

---

**Status:** §1, 2, 4–8 VALIDATED 2-0 (blind A/B, 2026-07-05, under the 0.1.0 wording —
`_evidence/validation/results.md`). Condensed 2026-09-20; §3 and the size trigger are
round-2, transcript-derived, NOT blind-validated.
Evidence: `_evidence/findings.md` §D2, `_evidence/findings-r2.md` §4.
Drift re-check: `grep -c 'REPORT ONLY' .claude/skills/grill-your-own-work/SKILL.md`
