---
key: local-codex-tooling-fixes
name: Task
task_name: "Local tooling fixes — 5 verified findings from Codex adversarial review"
visibility: workspace
priority: normal
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: fe0eb6ac-6620-456c-a466-82b911d95016
---

**Source:** Codex adversarial review (2026-07-18), all 5 findings independently verified true · **Scope:** Khoi's untracked local tooling — does NOT affect PR #206 code · **Left unfixed per review-only constraint**

## Findings (verbatim severity from Codex)

1. **[high] `.claude/worktrees/` breaks required verification gates** (`.gitignore:64-65`). Only `.worktrees/` is ignored; the real worktrees total 4.1 GB with nested configs, embedded repos, and secret-bearing `.env.local` files. Biome fails on nested root configs; `bun test` exhausts file descriptors. → Add `.claude/worktrees/` to `.gitignore` (or relocate worktrees outside the repo), confirm no env files staged, rerun gates.
2. **[high] SessionStart hooks not portable** (`.codex/hooks.json:8-16`). Hard-codes `/Users/khoivo/...`; cannot work in Codex cloud or another machine. → Resolve via `$(git rev-parse --show-toplevel)`; verify from repo root and a nested cwd.
3. **[high] Flutter provisioning silently no-ops under Codex** (`.codex/hooks/flutter-setup.sh:10-38`). Still Claude-specific: checks `CLAUDE_CODE_REMOTE`, writes `CLAUDE_ENV_FILE`, reads `CLAUDE_PROJECT_DIR`; under `set -u` can hard-fail if the remote flag is set manually. Codex supplies hook context via JSON stdin; async command hooks unsupported. → Move SDK install to the Codex cloud setup/maintenance script; drop Claude variables.
4. **[high] Detection reviewers are allowed to edit** (`.codex/agents/review-maintainability-simplification.toml:26-31`; 7 of 8 reviewer TOMLs similar). Eight reviewers run concurrently on a shared working tree with "freely apply cleanup" instructions — edits race and contaminate the diff mid-detection. → Make all detection reviewers report-only with `sandbox_mode = "read-only"`; apply fixes in a separate sequential phase.
5. **[high] Automated rollback can erase user work** (`review-maintainability-simplification.toml:140-145`). On ANY verification failure (including pre-existing ones) the agent runs `git restore --staged --worktree` over renamed paths from the entire diff — not limited to its own edits; irreversibly discards user work. → Delete the destructive rollback; isolate agent edits in a worktree or retain an exact patch and stop-and-report on failure.

## Why it matters

Items 4–5 make the local Codex reviewer fleet actively dangerous to run against a dirty working tree; items 1–3 mean the "required gates" (biome / bun test / filesize) can't produce a trustworthy baseline on this machine until the worktrees are ignored or moved.

## Suggested order

1 (unblocks gates) → 5 (removes the destructive command) → 4 (read-only reviewers) → 2, 3 (portability).
