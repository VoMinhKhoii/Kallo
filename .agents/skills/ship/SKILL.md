---
name: ship
description: |
  MANUAL TRIGGER ONLY: invoke only when user types /ship.
  Full Git shipping workflow — from unstaged changes to a clean, merged-ready PR:
  explicit staging, branch, conventional commit, a local adversarial Codex review,
  push through the pre-push gate, draft PR, CI and review loop until clean. Use
  when the user says "ship this", "commit and PR", "push and open a PR", or
  anything that implies taking local changes all the way to a reviewable pull
  request.
---

# Ship

The one maintained version of this workflow is `.claude/skills/ship/SKILL.md`.
Read it and follow it exactly; this copy exists so agents that load skills from
`.agents/skills/` find it.

The pre-push gate (`.githooks/pre-push`) runs only for agent shells. Claude Code
marks its shells with `CLAUDECODE=1`; any other agent pushes with
`KALLO_AGENT=1 git push …` so the same gates run. Never bypass it with
`--no-verify`.
