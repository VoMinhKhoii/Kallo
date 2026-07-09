---
name: delegate-and-verify
description: |
  Subagent discipline — invoke whenever dispatching subagents (reviews, audits, fix
  fleets, research fan-outs) or whenever consuming another agent's/session's claimed
  results (handoff notes, "previous session fixed X", fleet self-reports). The recorded
  Opus failure modes: review subagents given edit access that collided and broke the
  build, and subagent self-reports relayed as fact without independent verification.
allowed-tools:
  - Agent
  - Bash
  - Read
  - Grep
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Delegate and Verify

**The recorded failures this prevents:** during a `/review-before-pr`, 8 subagents ran
WITH edit access and "auto-applied several fixes concurrently — multiple agents touched
`linked-accounts.tsx`… in parallel. That's risky" — the collision regressed
`flutter analyze` from clean to failing, a CI blocker the orchestrator then had to fix
(`47ea3a99` L339→349). Separately, a fix-fleet's self-reported test counts were relayed
as fact and pushed without an independent orchestrator run (`8c0bed51` L3012→3023).

---

## Rule 1 — Reviewers and auditors are REPORT-ONLY

Every review/audit/verification subagent prompt contains, verbatim:
**"REPORT ONLY. DO NOT EDIT ANY FILES."**
(`8c0bed51` L2912-18 — the recorded Fable contract.) Fixing is a separate, deliberate
phase after the verdict. If two agents may write, they get isolated worktrees or
strictly disjoint file sets — never shared write access to one file.

## Rule 2 — Fix-fleets get prescribed designs, not open mandates

When dispatching agents to FIX findings, prescribe the fix design for anything tricky
"so nothing gets improvised badly" (`8c0bed51` L2992): file:line, the intended
mechanism, and what must NOT change. Open-ended "fix it" prompts to fleets produce
improvisations the orchestrator then has to re-review anyway. Credit justified
deviations when an agent explains one (`8c0bed51` L3032) — prescription is a floor,
not a cage.

## Rule 3 — Never relay a subagent's self-report as fact

A subagent saying "all tests pass" or "removed all occurrences" is a CLAIM. Before you
repeat it to the user, commit, or push:
- re-run the gate the claim rests on yourself (or a targeted subset + the full gate
  before push), and
- grep for what they say they removed/changed ("Verified clean — zero surviving
  uncertainty surfacing. Pushing" — `8c0bed51` L3013, done right; L3012→3023, the
  recorded lapse when the suite counts were relayed unverified).
This applies equally to handoff notes from previous sessions: verify the claimed state
before building on it.

## Rule 4 — Delegate to buy wall-clock, not to avoid thinking

Launch research/exploration agents in the background FIRST, then do foreground work
while they run ("let me launch those in the background first, then do the visual fixes
while they research", `ad88fbba` L1012). When an agent times out or dies, adapt
immediately rather than blocking: "the review agent timed out → I'll do the grilling
myself with direct reads" (`932ee514` L983).

## Rule 5 — Size fan-outs to the budget; make them resumable

A 37-agent sweep tripped the session token limit three times and needed two "please
continue" nudges (`8c0bed51` L114-151). It was rescued only because the workflow was
journal-resumable, and when told to stop, the right move was salvage-from-journal, not
rerun (L197-207). Before a large fan-out: estimate agents × tokens vs remaining budget;
prefer pipelined batches; make partial results harvestable.

---

**Status: WEAKLY VALIDATED 2-0 (blind A/B on Opus, 2026-07-05) — read the caveat.**
Both wins exercised Rule 3 (never relay claimed results — the lying-handoff trap and
independent ground-truthing). Rule 1 (REPORT-ONLY dispatch) was NOT testable: arms are
subagents and cannot spawn subagents, so that rule rests on transcript evidence alone
(`47ea3a99` L339/349). Details: `.claude/skills/_evidence/validation/results-batch2.md`.
Evidence: `.claude/skills/_evidence/findings.md` §F7/§D2.5/§D7 (47ea3a99 L339/349;
8c0bed51 L2912-18, L2992, L3013, L3012→3023, L197-207; ad88fbba L1012; 932ee514 L983).
Last verified: 2026-07-05. Drift re-check: `ls .claude/commands/review-before-pr.md`
