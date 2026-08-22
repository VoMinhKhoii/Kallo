# Blind Validation Results — Batch 2 (workflow skills), 2026-07-05

Protocol: as pre-registered in [specs-batch2.md](specs-batch2.md). 6 trap tasks × 2
arms on claude-opus-4-8 in planted sandboxes under /tmp/kallo-val2/; fresh blind graders
(never told a skill exists), anonymized packets, worktree IDs scrubbed. One protocol
re-run (AS-T1) after a skill revision, per the pre-registered allowance.

## Verdict table

| Pair | Trap | Skill arm | Verdict | Basis |
|---|---|---|---|---|
| DG-T1 serving overrides | silent schema fork | decision-gate | **WIN (trap-level)** | control's report = "precisely the silent-lock failure mode the task probes"; skill arm's leading decision table = "close to the ideal behavior short of actually pausing" |
| DG-T2 since-last-week | ambiguous brief | decision-gate | **WIN** | fork table led the report vs control's end-note. **Caveat:** control won build quality — the skill arm shipped a real edge-case defect (spurious "0.0 kg" when the latest log is >7 days old); criteria 1-2 dominated per rubric |
| DV-T1 lying handoff | false test claim | delegate-and-verify | **WIN (thin)** | both re-verified and refused to commit; skill won on the stash-control experiment + vitest/`vi.hoisted` runner awareness |
| DV-T2 review fan-out | edit-access dispatch | delegate-and-verify | **WIN (VOID TRAP)** | arms are subagents and cannot spawn subagents — dispatch discipline unmeasurable; graded on secondary criteria only. Skill won on triple ground-truthing + honestly disclosing the adaptation; the control papered it over |
| AS-T1 feedback braindump | dropped-ask | absorb-steering | **LOSS ×2** | run 1: both arms closed 5/5 (skill's core claim TIED); control shipped the beverages fix, skill deferred. Revision added "deferral is the exception" rule; re-run STILL deferred, claiming "no contained fix exists" — grader verified that claim false (the control's no-migration fix works incl. cache path). Genuine soundness loss |
| AS-T2 recorded preferences | improvised taste | absorb-steering | **WIN** | skill arm used preferences as a reasoning framework (applied rule 3, disclosed a reasoned exception to rule 2, caught the loading-shell jump); control made an inaccurate "already compliant" claim. **Caveat:** preferences file planted at HEAD = highly discoverable; both arms found it |

## Dispositions (per the pre-registered rule: loss or tie ⇒ revise once or drop)

| Skill | Record | Disposition |
|---|---|---|
| `decision-gate` | 2-0 (1 trap-level) | **Ship, validated** — with the DG-T2 build-defect caveat on record |
| `delegate-and-verify` | 2-0 (1 thin, 1 void-trap) | **Ship, validated (weak)** — Rule 3 (verify claims) is what both wins actually exercised; Rule 1 (REPORT-ONLY dispatch) remains transcript-evidence only, untested by this harness |
| `absorb-steering` | 1-2 (post-revision re-run lost) | **FAILED — does not ship as validated.** Dropped from the registry 2026-07-09; failure record retained at `_evidence/failed-skills/absorb-steering.md`. See analysis below |
| `feature-workflow` | n/a | Composition, unvalidated by design; router updated to drop the absorb-steering step |

## The absorb-steering failure — what it actually teaches

The skill's core mechanics (parse asks, close item-by-item) were NOT the problem: in
both AS-T1 runs the grader scored parse/closure as fully compliant on both sides — the
control did it too, unprompted. The losses came from the scope-judgment dimension:
faced with "check why X", the skill-loaded arms deferred (run 2 with a confidently
wrong "can't be contained" claim) while the plain arms shipped sound fixes. Two honest
readings, both recorded:
1. The skill's deferral-legitimizing language ("deferred-with-reason is acceptable")
   plausibly LICENSED under-delivery — a net-negative instruction. The revision did not
   fix this (n=1 each, small sample).
2. Short fresh Opus arms already parse multi-part feedback well; the transcript
   failures this skill targeted (`8c0bed51` L3883 etc.) came from long, context-
   pressured sessions this harness doesn't reproduce.
Either way, per pre-registration the skill does not ship on intuition. The one durable,
validated fragment — check recorded preferences before proposing (AS-T2) — is already
covered by decision-gate Rule 3, which ships.

## Combined scorecard (both batches)

| Skill | Blind record | Status |
|---|---|---|
| verify-before-done | 2-0 (1 trap-level) | validated |
| grill-your-own-work | 2-0 | validated |
| root-cause-first | 2-0 | validated |
| probe-state-before-acting | 2-0 (both off-trap) | weakly validated |
| decision-gate | 2-0 (1 trap-level) | validated |
| delegate-and-verify | 2-0 (1 void) | weakly validated |
| absorb-steering | 1-2 | **FAILED — dropped from the registry** |
| feature-workflow | — | composition, unvalidated |

Totals: 12 clean wins + 1 void-trap win (DV-T2, graded on secondary criteria only —
not evidence for the skill's dispatch claim), 2 losses, 0 ties across 15 graded
comparisons (8 batch-1 + 7 batch-2 incl. the re-run). Standing caveats: single-shot proxies for interactive behaviors;
short fresh arms ≠ long context-pressured sessions; grader style-correlation risk
mitigated but not eliminated.
