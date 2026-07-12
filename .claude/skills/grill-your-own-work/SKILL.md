---
name: grill-your-own-work
description: |
  Adversarial self-review closer — run AFTER a feature is "complete and verified" and
  BEFORE declaring done, /ship, or opening a PR; also when asked to review another
  session's/model's/agent's work ("grill this", "audit this", "check Opus's work").
  Encodes the exact protocol the user repeatedly switches models to get: independent
  gates first, suspicion-driven probes, defect-preexists-on-base checks, REPORT-ONLY
  subagents, self-verified headline findings, severity-ordered graded verdicts. In the
  one recorded direct A/B, this pass turned a green-gated "complete" feature port into
  a one-go merge by finding 9 logic bugs and 4 missing parity features first.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Grill Your Own Work

**Why this exists:** the user manually flips models and types "grill this work from
opus" — verbatim, in three separate recorded sessions (`83d4b9bf` L880, `bf4eb0ac`
L899, `8c0bed51` L2871) — because a "complete and verified... All gates green" claim
(`932ee514` L945) once concealed 9 logic bugs, 4 skipped parity features, and an
entirely unported widget (`932ee514` L1052, L1371). This skill makes that closer a
standard step instead of a manual rescue.

Run it on your own just-finished work exactly as you would on someone else's. Your
attachment to the code is the bias being corrected.

---

## The protocol

### 1. Independent gates first — before re-reading the diff
Run the full repo gates fresh (`bunx tsc --noEmit`, `biome ci .`, `bun vitest run`;
mobile: `flutter analyze`, `flutter test`) plus any cheap domain invariants you can
script on the spot (e.g. the hand-written en/vi locale-key parity script at `8c0bed51`
L2874-75). Do not trust the gate results from the build phase — they may be stale, or
run from the wrong directory (`932ee514` L872).

### 2. Enumerate the mandate, then diff reality against it
Re-read the ORIGINAL ask (full parity? all paths? which platforms?). List every
promised behavior and check each exists. The worst recorded miss was structural, not
subtle: "CirclePresenceStrip — not ported at all... blockCircleFriend mutation was
never actually written" under an explicit full-parity mandate (`932ee514` L1371).

### 3. Suspicion-driven probes on the risky spots
Before writing any verdict, list the 3-6 places you'd bet a bug hides — cross-layer
contracts, cache/query keys, state after mutations, auth boundaries — and probe each
directly. This is what landed the critical bug in `bf4eb0ac` L902→L934: "Wrong query
key: the logging feed never refreshes after split or accept." Typical probes: trace a
query key end-to-end, grep both sides of a contract, run one real request, check the
doc-comment against the implementation (an endpoint once returned `status: 'blocked'`
while its own comment said "never reveals a block", `932ee514` L1052 A2).

### 4. Does the defect pre-exist on the base?
Before blaming the diff for anything you find:
```bash
git show origin/main:<file> | grep -n <suspect>
```
so review findings are attributed correctly (`8c0bed51` L2886). Pre-existing issues get
reported separately, not fixed silently in this pass.

### 5. Subagents are REPORT-ONLY
If you fan out review subagents, every prompt includes: **"REPORT ONLY. DO NOT EDIT ANY
FILES."** (`8c0bed51` L2912-18). The recorded counter-case: review agents dispatched
with edit access auto-applied conflicting fixes and regressed `flutter analyze` from
clean to failing (`47ea3a99` L339→L349). Fixing happens after the verdict, deliberately.

### 6. Self-verify the headline finding before reporting it
Reproduce your worst finding directly before it goes in the report ("Quick self-check
on the alleged mobile blocker before reporting... The grill caught a genuine functional
bug", `83d4b9bf` L932). Also re-verify subagent claims independently — grep for what
they say they removed, run what they say passes (`8c0bed51` L3013). Do NOT relay a
fix-agent's self-reported test counts as fact (the one recorded lapse: `8c0bed51`
L3012→L3023).

### 7. Verdict format
- **Severity-ordered, worst first** ("Here's the case against this PR, worst first",
  `bf4eb0ac` L934).
- **Graded, not binary**: "yes-with-fixes — the overhaul is real and mostly excellent,
  but it is not yet at your bar" (`8c0bed51` L2986).
- **Honest negatives**: include a "Non-issues verified (no action)" section
  (`932ee514` L1052) so cleared suspicions aren't re-litigated.
- **Escalations**: findings needing a human decision are marked "need your decision"
  (`83d4b9bf`), not silently resolved.
- When fixes follow, prescribe the fix design for the tricky ones "so nothing gets
  improvised badly" (`8c0bed51` L2992), then re-run step 1.

---

**Status: VALIDATED 2-0 (blind A/B on Opus, 2026-07-05).** Both control arms also found
the planted bugs — the wins came from the protocol's artifacts: a self-verified
regression test, fresh full-repo gates, and empirical base-vs-diff attribution decided
both blind verdicts. Details: `.claude/skills/_evidence/validation/results.md`.
Evidence: `.claude/skills/_evidence/findings.md` §D2 vs §F1. Externally corroborated:
Anthropic's Fable 5 guide — "separate, fresh-context verifier subagents tend to
outperform self-critique."
Last verified: 2026-07-04. Drift re-check: `ls .claude/commands/review-before-pr.md && grep -rn 'REPORT ONLY' .claude/skills/grill-your-own-work/`
