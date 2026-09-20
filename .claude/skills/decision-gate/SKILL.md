---
name: decision-gate
description: |
  Invoke before writing a plan or code for any open-ended brief ("figure out", "design",
  "improve", "you decide"), and before locking anything expensive to reverse: schema or
  migration shape, a new endpoint or API contract, a new UI primitive, a UX paradigm, a
  dependency, the scope of a PR. Teaches where to stop and ask — not how to plan.
allowed-tools:
  - Read
  - Grep
  - Bash
  - AskUserQuestion
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Decision Gate

Planning quality is not the problem on record — plans were rejected in 4 of the last 14
sessions for **scope and inventory**, and the largest single rework was a server surface
the repo already had a pattern for.

## 1. Reconcile scope against the source of truth before planning

Read the thing the user is pointing at (pricing card, canvas, spec, ticket) and list
every item it implies; the plan covers the list or says what it leaves out and why.
"2 more Premium-only features" was taken as the whole scope and the plan was rejected
twice (`f6072383` L89, L105); another plan scoped out exactly what the user wanted
(`92b05d3b` L263→L351); another missed two features in the inventory (`cc03e22b` L106).

## 2. Reuse probe before any new surface

Before adding an endpoint, primitive, asset or migration shape, grep for the repo's
existing answer (`components/ui`, `components/shared`, `lib/brand`, a similar flow's
handling). An undo endpoint + tests + route-inventory entry was built unasked, three
review P1s lived inside it, then: "Why do we need an API for undo?" → "The repo already
has this pattern: meal delete waits until its toast closes" → all deleted
(`56cfd62e` L1661→L3656→L3747). Same session hand-rolled tabs and an avatar that
existed; another guessed the wordmark's font while the vector sat in `lib/brand/kallo.ts`
(`21d1773a` L1894→L2357).

## 3. Split forks from implementation

Forks — two defensible designs, taste, or expensive reversal — are the user's unless
delegated. Always gated here:
- schema / migration *design* (before the file exists); new server surface
- auth flows, data export/deletion semantics, sharing/privacy defaults, billing
- UX paradigm changes on canonical surfaces (dashboard, logging, onboarding)
- new dependencies (and `bun add`, never a hand-edited `package.json`)

## 4. One decision table, recommendation first

Bundle the forks into a single AskUserQuestion / options table. The smoothest session on
record asked exactly one (`97979119` L156). Non-interactive run → the table goes at the
TOP of the report and you build only what is common to all options.

## 5. Check recorded preferences first; respect the answer after

Grep `MEMORY.md`, AGENTS.md, the kallo-design skill before proposing — a saved preference
was ignored 1,900 lines after it was saved (`f3074584` L302→L2230). Once the user rules,
that ruling holds: do not merge past "holding on your two rulings" without them
(`21d1773a` L2217→L2279, inferred), and do not re-ask what is settled ("build the winner").

## 6. Ambiguous brief → name the readings, default to the reversible one

State which reading you proceed on and why; flag the others. Never pick silently.
Numbers, versions and fees you did not look up are marked as assumptions or not written
at all — "the 204/126/18 that I invented" (`5182cdc4` L3084); "I inferred that, I didn't
cite it" (`67ee41da` L4578).

---

**Status:** rules 3–6 VALIDATED 2-0 (blind A/B, 2026-07-05, under the 0.1.0 wording —
`_evidence/validation/results-batch2.md`; caveat on record: improves decision surfacing,
not code quality). Condensed 2026-09-20; rules 1–2 are round-2, transcript-derived, NOT
blind-validated.
Evidence: `_evidence/findings.md` §F-decision, `_evidence/findings-r2.md` §R6/§R7.
Drift re-check: `ls components/ui components/shared lib/brand >/dev/null`
