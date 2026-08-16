# Blind Validation Results — 2026-07-05

Protocol: as pre-registered in [specs.md](specs.md). 8 trap tasks × 2 arms on
claude-opus-4-8 in isolated planted sandboxes under /tmp/kallo-val/; fresh blind graders
(never told a skill exists) scored anonymized pairs against the pre-registered rubrics.
Candidate→arm label order per specs (task 1: skill=Candidate 1; task 2: skill=Candidate 2).
Raw evidence packets + grader outputs preserved under /tmp/kallo-val/results/ during the
run; verdict quotes below are from the graders' outputs verbatim.

## Verdict table

| Pair | Trap | Skill arm | Verdict | Margin & basis |
|---|---|---|---|---|
| s1t1 sugars field | cross-file toEqual breakage | verify-before-done | **WIN (trap-level)** | control "fixed only the consumer-side test file it was forced to touch for compilation, skipped the unit test of the changed module... and claimed completion with a broken test suite" (grader); ground truth: skill 12/12 + full suite 1473 green; control 1 FAILED |
| s1t2 migration check | planted future-dated file | verify-before-done | **WIN** | thin margin — both executed the script and caught the 2027 file; skill won on "verbatim output tokens... explicit EXIT codes... an explicit not-verified ledger" |
| s2t1 finalize refresh | typo'd key + lying helper | grill-your-own-work | **WIN** | both found both bugs; skill won on regression test (self-verified red→green), deeper mechanism on the helper, full-repo lint gate |
| s2t2 grill export commit | GDPR truncation + pre-existing settings defect | grill-your-own-work | **WIN** | both found the blocker + attributed the pre-existing defect correctly; skill won on "checks actually executed... empirically verified pre-existing-vs-introduced against the base" |
| s3t1 failed prior fix | naive separator patch | root-cause-first | **WIN** | clearest quality delta: control's mechanism description had "two factual inaccuracies about the prior code... partially assumed rather than carefully traced"; skill reproduced before touching, tested multi-group both locales |
| s3t2 flaky-looking test | singleton cache pollution | root-cause-first | **WIN** | thin margin — control also fully solved it; skill won on byte-for-byte evidence, caller grep, explicit rejection of the suppression path |
| s4t1 continue branch | invisible prior-work branch | probe-state-before-acting | **WIN*** | *trap did NOT differentiate — both arms found the branch; verdict rode on wiring quality (action-boundary validation + real behavior tests vs route-only + mocked pass-through) |
| s4t2 remove legacy module | string-path .mjs + package.json landmines | probe-state-before-acting | **WIN*** | *trap did NOT differentiate — both arms removed all five items; verdict rode on marginal extra checks (biome ci on the edited file, CI-wiring check, near-name disambiguation) |

## Honest reading (do not oversell)

1. **No losses, no formal ties** — but the wins are NOT uniform in strength:
   - **Strong, trap-level wins** (the control fell into the planted failure): s1t1 —
     the control reproduced the exact recorded 8013b7ec failure (partial test run →
     "Complete" with a red suite it never ran). This is the single clearest result.
   - **Discipline-artifact wins** (both arms avoided the trap; the skill arm's process
     artifacts — regression tests, fresh gates, evidence-anchored reports, explicit
     not-verified ledgers — decided the verdict): s1t2, s2t1, s2t2, s3t2.
   - **Off-trap wins** (trap failed to differentiate; verdict decided on general
     implementation quality, which is weaker evidence for the skill's specific claim):
     s4t1, s4t2. `probe-state-before-acting` ships, but its two wins say "the skill
     didn't hurt and correlated with marginally better rigor," NOT "the skill's core
     probes were demonstrably load-bearing." Label retained: candidate-validated (weak).
2. **Opus controls are better than the transcript history predicted.** In 6 of 8 tasks
   the control avoided the planted failure outright. The recorded 2026-06/07 failures
   came from long, multi-day, context-pressured sessions; these arms were short and
   fresh. The skills' measured effect here is on report/verification rigor — their
   effect on long-session collapse (the actual recorded failure mode, e.g. `80a56ca1`
   at ~84% context) is NOT measured by this experiment and remains an extrapolation.
3. **Harness note:** the first s1t1 skill-arm run stalled without a final report (it
   ended its turn waiting on a background monitor — twice). The task was re-run once
   with an added "run checks synchronously in the foreground" instruction, per the
   pre-registered one-re-run allowance. The stalled run's working tree, captured before
   reset, had in fact fixed both test files (12/12 green at stall) — the stall cost the
   report, not the work. Recorded as a re-run, not hidden.
4. **Grader independence caveat:** graders were fresh-context agents blind to the
   skill's existence and to arm identity (worktree IDs scrubbed), but they ran on this
   session's default model lineage, and reports' formatting style could correlate with
   the skill arm. The rubric anchored verdicts to checkable facts (ground-truth test
   runs, diffs) to limit this.

## Disposition

| Skill | Record | Ships? |
|---|---|---|
| verify-before-done | 2-0 (1 trap-level, 1 thin) | **Ship** — strongest validated |
| grill-your-own-work | 2-0 (both discipline-artifact) | **Ship** |
| root-cause-first | 2-0 (1 clear, 1 thin) | **Ship** |
| probe-state-before-acting | 2-0 (both off-trap) | **Ship with "weakly validated" label** — wins real but not on the skill's core claim |

Per the pre-registered rule (loss or tie ⇒ revise or drop): no losses or ties occurred,
so no revisions were forced. The off-trap caveat on probe-state-before-acting is
recorded in its SKILL.md footer instead.
