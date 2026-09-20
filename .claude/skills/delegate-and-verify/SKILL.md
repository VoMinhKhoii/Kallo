---
name: delegate-and-verify
description: |
  Invoke before dispatching ANY subagent (review, audit, fix fleet, implementer,
  research fan-out) and before building on another agent's or session's claimed results
  (handoff notes, "previous session fixed X", worker self-reports). REPORT-ONLY
  reviewers, one writer per file set, a brief file instead of long prompts, and no claim
  relayed unverified.
allowed-tools:
  - Agent
  - Bash
  - Read
  - Grep
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Delegate and Verify

The strongest skill on record: invoked in 5 of the last 14 sessions and it visibly
changed behavior in all 5 — there have been no edit-access reviewer collisions since it
shipped. What remains is cost and relayed claims.

## 1. Reviewers and auditors are REPORT-ONLY

Every review / audit / verification prompt contains, verbatim:
**"REPORT ONLY. DO NOT EDIT ANY FILES."** Writers get isolated worktrees or strictly
disjoint file sets, and commit only after you have verified their work (`f6072383` L167,
L866 — done right). The original failure: eight reviewers with edit access collided on
one file and broke `flutter analyze` (`47ea3a99` L339→L349).

## 2. Fix fleets get prescribed designs, not open mandates

File:line, the intended mechanism, what must NOT change. For a defect the user has
re-reported, the dispatch demands reproduction evidence before any fix — "two prior
'fixes' passed their own tests while you still see it broken" (`21d1773a` L2380).

## 3. Never relay a claim you have not seen evidence for

"All tests pass", "removed all occurrences", "already correct" are CLAIMS. Before
repeating one to the user, committing or pushing: re-run the gate it rests on, grep for
what was supposedly removed, look at what was supposedly fixed. "report-only claims are
not facts" (`21d1773a` L890) found three real mechanisms; the one lapse in that session
was a relayed "already correct" — "my earlier relay… was wrong" (L2560). **Verified
means behavior, not just gates and greps** (`cc03e22b` L389: fleet-verified "complete",
e2e then found 3 defects). Handoff notes and memory entries get the same treatment.
And never claim your own action before it happened — "I said I was starting the reviews
but hadn't actually launched them" (`21d1773a` L2571).

## 4. One brief file; prompts point at it

Write the shared context once — goal, worktree path, base branch, gates, conventions,
output shape — to a file, and make each prompt a pointer plus the agent's specific
assignment. On record: 26 prompts ≈ 111KB (`f3074584`), 19 ≈ 117KB (`4b54de9b`), each
restating what a plan file already held. Batch steers into one SendMessage instead of
one per thought (~25 in `21d1773a`). Tell workers to use small tool calls — three
stream-watchdog stalls came from oversized ones (`f3074584` L5163, L6568).

## 5. Don't fight your own fleet for the toolchain

Never run the full suite while a worker is running it, or alongside a simulator build:
11,040s and 66 bogus errors (`f6072383` L991–1003); a 600s foreground timeout
(`21d1773a` L1632). Wait for the task notification — do not poll a task's output file in
a foreground `until` loop (8 such loops hit the 600s timeout, `f3074584` L6035).

## 6. Delegate to buy wall-clock; size to the budget

Launch background research FIRST, then do foreground work while it runs. Before a large
fan-out: agents × tokens vs remaining budget; prefer pipelined batches; make partial
results harvestable. If a fleet dies on a rate limit, **re-dispatch it or disclose the
gap** — four auditors failed seconds after launch and the task was closed on a solo
audit (`21d1773a` L219–225, L580). A dead agent → adapt immediately, don't block.

---

**Status:** rule 3 WEAKLY VALIDATED 2-0 (blind A/B, 2026-07-05, under the 0.1.0 wording;
rule 1 was untestable — arms cannot spawn subagents; `_evidence/validation/results-batch2.md`).
Condensed 2026-09-20; rules 4–5 and the additions to 2, 3, 6 are round-2,
transcript-derived, NOT blind-validated.
Evidence: `_evidence/findings.md` §F7/§D2/§D7, `_evidence/findings-r2.md` §3/§4.
Drift re-check: `ls .claude/commands/review-before-pr.md`
