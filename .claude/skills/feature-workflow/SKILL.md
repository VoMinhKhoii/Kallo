---
name: feature-workflow
description: |
  The umbrella dev loop for any non-trivial feature, fix, or refactor in this repo —
  invoke at TASK START, before exploring or editing. It does not add new rules; it
  sequences the validated discipline skills at the phase boundaries where the recorded
  Opus sessions put them in the wrong order (gates at the end instead of per phase,
  review after merge instead of before done, decisions locked before the user saw
  them). Routes to: decision-gate → probe-state-before-acting → implement with
  per-phase verification → verify-before-done → grill-your-own-work → /ship.
allowed-tools:
  - Skill
  - Read
  - Bash
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-composition"
---

# Feature Workflow

**Why a router:** the evidence shows Opus has every individual discipline — it runs
gates, reviews, plans well — but sequences them wrong. The Circle port ran ALL its
verification once, at the end (`932ee514` L945 → 9 bugs found post-"done"); the
meal-card sessions reviewed after shipping (`8c0bed51`, 3-surface revert); the barcode
session locked a schema design before the user saw it (`8013b7ec` L66). Right pieces,
wrong order. This skill is the order.

---

## Phase 0 — Orient (before ANY edit)

1. AGENTS.md §2.2 preflight: invoke the matching stack skills (vercel-react-best-practices
   / nham-design / mobile docs) — the most-skipped mandatory step on record.
2. Load **probe-state-before-acting**: fetch, check whether the branch/work already
   exists, confirm the worktree root. (Worktree from latest main per repo convention.)
3. Restate the ask. If it's multi-part feedback, produce a numbered parse of every
   distinct ask first, and close each explicitly in your wrap. (A dedicated
   absorb-steering skill FAILED blind validation — its deferral framing correlated with
   under-delivery — so this router keeps only the parse/close mechanic, which tied, and
   drops the rest.)

## Phase 1 — Decide (before building)

Load **decision-gate**. Split forks from implementation. Surface forks as ONE
decision-table question (or the top of your report if non-interactive). Schema/auth/
export-semantics/UX-paradigm forks are always gated. Only then plan the build — plan
depth itself is your call; the evidence shows no planning-quality gap, so don't
over-ceremonialize small tasks.

## Phase 2 — Implement (verification per phase, not terminal)

- After each coherent chunk: targeted tests + analyze/tsc on the touched area. Do NOT
  save all verification for the end — terminal-only verification is the single
  costliest recorded pattern.
- Unfamiliar library → read `node_modules/**/*.d.ts` + Context7 before coding against it.
- Anything unexpected during your own QA → load **root-cause-first** before continuing.
- Delegating? Load **delegate-and-verify** first (REPORT-ONLY reviewers, prescribed fix
  designs, never relay self-reports).

## Phase 3 — Close (before saying "done")

1. Load **verify-before-done**: full gates from the right root + behavior-altitude
   observation + evidence-audited report.
2. For features beyond a trivial patch, load **grill-your-own-work**: adversarial pass
   on your own diff before the user sees it. This is the step the user used to trigger
   manually by switching models — make it automatic.
3. Ship via **/ship** only when the user asks; branch naming + conventional commits per
   AGENTS.md.

## Session-long invariants

- Steering arrives → parse it into numbered asks, act, close item-by-item in the wrap.
- Context pressure rising → verify FIRST, then summarize; externalize state (plan file,
  tasks, memory) instead of holding it in context.
- End of session → AGENTS.md retrospective + memory write for durable lessons.

---

**Status: COMPOSITION — not independently validated.** The four routed discipline
skills were blind-validated 8-0 individually (batch 1) and the routed batch-2 skills
carry their own validation records; this router itself is ordering logic distilled from
the recorded sequencing failures, and a router cannot be trap-tested in a single-shot
arm. Treat its value claim as: "the pieces are proven; the order is evidence-derived
but unproven as a bundle."
Evidence: `.claude/skills/_evidence/findings.md`; validation:
`.claude/skills/_evidence/validation/results.md`.
Last verified: 2026-07-09. Drift re-check: `ls .claude/skills/{verify-before-done,grill-your-own-work,root-cause-first,probe-state-before-acting,decision-gate,delegate-and-verify}/SKILL.md`
