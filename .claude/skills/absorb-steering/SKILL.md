---
name: absorb-steering
description: |
  Feedback discipline — invoke whenever the user sends feedback, corrections, a
  multi-part message, a voice-note-style braindump, or mid-task redirection; also when
  resuming work that has prior feedback on record. The recorded Opus failure is dropped
  or half-applied feedback items forcing the user to repeat themselves; the recorded
  Fable counter-behavior is parsing every steer into a numbered worklist and closing it
  item-by-item.
allowed-tools:
  - Read
  - Grep
  - TaskCreate
  - TaskUpdate
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Absorb Steering

**The recorded behaviors this encodes:** every steer in the flagship Fable session was
answered first with an explicit parse — "Voice note parsed — four asks: (1)… the
country-pointer is the meaty one" (`ad88fbba` L1343); "Great feedback — four
workstreams: (1)… (4)" (L1012) — and the wrap message closed the loop item-by-item:
"All five points from your feedback are in — screenshot above" (L1556). The recorded
failures on the other side: polish proposed without checking stored first-round
preferences until the user flagged it (`8c0bed51` L3883), a review re-anchored twice to
a doc the user had already named (L2908), and an a11y-only reading of a request the
user had to push past twice (L4221/4241).

---

## Rule 1 — Parse before acting: number the asks

The FIRST thing you produce after any multi-part feedback is the parse: a numbered list
of every distinct ask, including the half-sentence ones and the "btw" riders. Restate
each in your own words. Feedback messages routinely carry 3-6 asks; the recorded
failure mode is executing the two obvious ones and silently dropping the rest.
- If an item is ambiguous, say which reading you're taking (see `decision-gate` Rule 4).
- If items conflict, surface the conflict in the parse, not after building.
- For sessions with task tracking, one task per ask.

## Rule 2 — When corrected, restate the direction back

On a corrective steer (you got something wrong), do not just fix the instance — restate
the corrected principle in one sentence before re-executing, so the user can veto a
wrong generalization. Recorded model: founder pushback on audit voice → direction
restated verbatim before the rewrite (`8c0bed51` L383).

## Rule 3 — Check the feedback that already exists

Before proposing designs, polish, or process changes, grep the prior-feedback surfaces:
memory files, `AGENTS.md`, `docs/DESIGN.md`, recent session notes, and any
preferences/conventions doc in the repo. New proposals must not re-violate recorded
preferences ("looks like the revert back did include some that violate those" —
`8c0bed51` L3883, the recorded miss).

## Rule 4 — Close item-by-item, or say which items are open

The wrap message after acting on feedback maps every numbered ask to its outcome:
done (+ how verified), deliberately deferred (+ why), or blocked (+ on what). "All five
points from your feedback are in" (`ad88fbba` L1556) is the shape. An item that
silently disappears between the parse and the wrap is the failure this skill exists to
prevent — including explicit directives you chose not to follow: the one recorded
Fable lapse was silently dropping a "go search for references" instruction (`ad88fbba`
L1613). Not doing something the user asked is sometimes right; not TELLING them is not.

**Deferral is the exception, not a default.** An investigation ask ("check why X") is
satisfied by a diagnosis — but if a sound fix fits the current scope and risk budget,
ship it WITH the diagnosis. Before deferring on a blocking concern (a migration, a
product decision), check whether a contained fix exists that avoids that concern
entirely; defer only when it genuinely doesn't, and say exactly what blocks it.
(Validation recorded a loss when a deferral-with-reason was outperformed by a peer who
found a no-migration path and shipped it.)

## Rule 5 — Steering is data: write durable corrections to memory

A correction that reflects a lasting preference (not a one-off) gets written to memory
with the why, per the memory conventions — that is how "approve decisions before
building" and the ttr-CLI convention stopped recurring. One line in the wrap: "saved to
memory: <slug>" so the user knows it stuck.

---

**Status: FAILED VALIDATION (1-2 on blind A/B, incl. a post-revision re-run loss) —
DO NOT AUTOLOAD.** The parse/close mechanics tied (controls did them unprompted); the
losses came from the deferral framing, which correlated with under-delivery on an
investigation ask — the re-run arm claimed "no contained fix exists" and a blind grader
verified that claim false. Retained for reference only; the one validated fragment
(check recorded preferences first) ships inside decision-gate Rule 3. Full analysis:
`.claude/skills/_evidence/validation/results-batch2.md`.
Evidence: `.claude/skills/_evidence/findings.md` §D6 (ad88fbba L1012/1343/1556/1613;
8c0bed51 L383/L2908/L3883/L4221-4241; ca3ab2c1 L989).
Last verified: 2026-07-05. Drift re-check: `ls ~/.claude/projects/-Users-khoivo-Documents-nham/memory/MEMORY.md`
