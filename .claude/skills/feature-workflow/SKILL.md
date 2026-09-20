---
name: feature-workflow
description: |
  Invoke FIRST, at task start, for any non-trivial feature, fix, refactor, design-to-code
  port or multi-PR job in this repo — before exploring, planning, brainstorming or
  editing — and again when resuming after a compaction. A one-page router: which
  discipline skill to load at which phase boundary. Adds no rules of its own.
allowed-tools:
  - Skill
  - Read
  - Bash
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Feature Workflow

The pieces work — every discipline skill that fired on record changed behavior. The
failures come from the ones that never fired: in 14 recorded sessions this router,
`decision-gate`, `probe-state-before-acting` and `verify-before-done` were invoked zero
times, and the two costliest failure classes (done-claims nobody observed; actions on a
shared or stale checkout) map exactly onto them. This page is the order. Load each skill
with the Skill tool — do not `cat` it.

| Phase | Do | Load |
|---|---|---|
| **0. Orient** — before any edit | AGENTS.md §2 preflight for the stack you'll touch (`kallo-design` for ANY UI, `vercel-react-best-practices`, mobile docs; the pre-read docs for DB / email / pipeline work). Where am I, is the branch already there, is the tree mine? | **probe-state-before-acting** |
| **1. Decide** — before a plan or code | Reconcile scope against the source of truth; reuse probe; surface forks as ONE decision table. Plan depth is your call — small tasks need no ceremony. | **decision-gate** |
| **2. Build** — per chunk, not at the end | Targeted tests + tsc/analyze on the touched area after each coherent chunk. UI work: render it as you go, not at PR time. | — |
| ↳ anything unexpected | a failure, a second identical hang, a "still broken" | **root-cause-first** |
| ↳ dispatching any subagent | brief file, REPORT-ONLY reviewers, no relayed claims | **delegate-and-verify** |
| ↳ restart / compaction / resume | re-probe cwd + branch before reading a file as evidence | **probe-state-before-acting** |
| **3. Close** — before "done" | CI-equivalent gates, behavior observed, diff composition, evidence-audited report | **verify-before-done** |
| ↳ diff spans 2+ files or platforms | adversarial pass on the design and the diff — before the user has to ask for one | **grill-your-own-work** |
| **4. Ship** | only when the user asks; `<type>/<slug>` branch, conventional commits | `/ship` |

## Session-long invariants

- Steering arrives → parse it into numbered asks, act, close each one in the wrap.
- A recipe or preference learned → memory in the same turn; check memory before choosing
  a tool or model.
- Context pressure → verify FIRST, then summarize; externalize state to a plan file or
  memory rather than holding it in context.
- Environment quirks and image hygiene: AGENTS.md §8.
- End of session → AGENTS.md retrospective + memory write for durable lessons.

---

**Status: COMPOSITION — not independently validated**; a router cannot be trap-tested in
a single-shot arm. The routed skills carry their own validation records. Rewritten
2026-09-20 after round 2 showed the ordering was never exercised in practice.
Evidence: `_evidence/findings.md`, `_evidence/findings-r2.md` §4, `_evidence/sessions-r2.md`.
Drift re-check: `ls .claude/skills/{verify-before-done,grill-your-own-work,root-cause-first,probe-state-before-acting,decision-gate,delegate-and-verify,kallo-design}/SKILL.md`
