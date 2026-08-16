---
name: decision-gate
description: |
  Decision discipline for open-ended briefs — invoke whenever a task says "figure out
  the best X", "design", "improve", "you decide", or whenever your implementation is
  about to lock in something expensive to reverse (schema/migration shape, API contract,
  UX paradigm, dependency choice, data model). The recorded Opus failure is building
  past decisions that were the user's to make; the recorded low-steering sessions won by
  surfacing exactly one well-framed decision at the real fork. This skill does NOT teach
  planning (the evidence shows no planning-quality gap) — it teaches WHERE to stop.
allowed-tools:
  - Read
  - Grep
  - Bash
  - AskUserQuestion
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Decision Gate

**The recorded failures this prevents:** on the open-ended brief "Figure out the best
UX", Opus designed AND committed a DB migration + schema columns without pausing for
sign-off ("I have the full picture. Here's my design, then I'll implement", `8013b7ec`
L66) — violating the user's recorded preference ("Approve the decision before launching
the build", memory). The user has also had to impose the gate manually: "use plan mode
here. ask back if need clarified anything" (`8a61a242` L1902). The counter-example: the
smoothest session on record (`97979119`, PR #166, ~zero corrective steers) front-loaded
comprehension, then asked ONE decision-table question at the one true ambiguity (L156).

---

## Rule 1 — Classify before you build: decision vs implementation

Before writing code, split the work into (a) things any competent engineer would do the
same way, and (b) **forks** — choices where two defensible designs exist, or taste is
involved, or reversal is expensive. Category (b) is the user's, not yours, unless they
have explicitly delegated it. Recorded taste-fork handling done right: "Before I
finalize, two genuine taste decisions are yours to make" → AskUserQuestion → then build
(`ad88fbba` L389-394).

Forks that are ALWAYS gated in this repo:
- schema / migration shape (AGENTS.md already forbids applying; this gate is about the
  *design*, before the migration file exists)
- anything touching auth flows, data export/deletion semantics, or sharing/privacy defaults
- UX paradigm changes on canonical surfaces (dashboard, logging, onboarding)
- new dependencies

## Rule 2 — One high-leverage question beats five small ones

Bundle the fork(s) into a single decision point, presented as a compact options table
with your recommendation first. The recorded model: "which meal-creation paths should
default-share" as one table (`97979119` L156) — it converted what would have been
multiple corrective steers into one answer. If you cannot ask (non-interactive run),
the same table goes at the TOP of your report, and you build only up to the fork:
implement the parts common to all options; do not lock the fork silently.

## Rule 3 — Check the recorded preferences before proposing

Before proposing any design/polish, grep the places this user's decisions already live:
memory files (`MEMORY.md`), `AGENTS.md`, `docs/DESIGN.md`, the kallo-design skill. The
recorded failure: proposing polish that violated stored first-round preferences, caught
by the user — "I did add some of my preference for the first round… looks like the
revert back did include some that violate those" (`8c0bed51` L3883; preferences were
read only AFTER the flag, L3887).

## Rule 4 — Ambiguity in the brief = enumerate, then default reversibly

When the request has multiple readings, name the readings explicitly (don't pick
silently — CLAUDE.md rule), state which you'll proceed on and why it's the reversible
one, and flag the others. A wrong silent reading cost a full corrective round when "ttr
as a task" was read as in-repo files instead of the ttr CLI (`ca3ab2c1` L989).

## Rule 5 — The gate is cheap; respect its output

Gating costs one message. The recorded cost of skipping it: a migration + schema built
on an unapproved design (`8013b7ec`), three shipped surfaces reverted wholesale when
the direction turned out wrong (`8c0bed51` L3103/3121). If the user has pre-approved
("build the winner", "address everything"), note the pre-approval in your report and
proceed — the gate is for decisions they haven't seen, not re-asking settled ones.

---

**Status: VALIDATED 2-0 (blind A/B on Opus, 2026-07-05).** DG-T1 was a trap-level win —
the control silently locked a schema design ("precisely the silent-lock failure mode"),
the skill arm led with a decision table. DG-T2 won on decision prominence; caveat on
record: the control out-built the skill arm there (the skill arm shipped an edge-case
defect), so this skill improves decision surfacing, not code quality. Details:
`.claude/skills/_evidence/validation/results-batch2.md`.
Evidence: `.claude/skills/_evidence/findings.md` §F-decision (8013b7ec L66, 8a61a242
L1902, 97979119 L156, ad88fbba L389, 8c0bed51 L3883) — plus user memory
`feedback_approve_decision_before_build`.
Last verified: 2026-07-05. Drift re-check: `grep -n 'Database Production Push\|Pre-Read Docs' AGENTS.md`
