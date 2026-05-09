---
description: Multi-axis pre-PR code review of the current branch using the Nham repo's review subagents.
argument-hint: "[--architecture] [--state | --correctness] [--data] [--simplify] [--react] [--performance] [--security [--security-heavy]] [--a11y]"
---

# /review-before-pr

You are coordinating a pre-PR code review of the work on the current branch. The Nham repo ships with eight focused review subagents under `.claude/agents/` (symlinked from `.github/agents/` so Copilot and Claude Code share the source of truth):

| Subagent | Focus | Flags |
| --- | --- | --- |
| `review-architecture-boundaries` | Layering, ownership, hotspot files, public APIs | `--architecture` |
| `review-correctness-state-flow` | Workflow correctness, async/state transitions, retries, side-effect duplication | `--state`, `--correctness` |
| `review-data-migration-safety` | Drizzle schema, SQL, migrations, RLS, query scoping | `--data` |
| `review-maintainability-simplification` | Dead code, redundant abstractions, simplification candidates | `--simplify` |
| `review-nextjs-react-patterns` | Next.js App Router conventions, RSC/Client boundaries, hooks correctness | `--react` |
| `review-performance-scalability` | Hot paths, N+1s, caching, streaming, large-data handling | `--performance` |
| `review-security-trust` | Auth, trust boundaries, secret handling, RLS, server actions | `--security`, `--security-heavy` |
| `review-ux-quality` | Accessibility, visual regressions, error states, empty states | `--a11y` |

## Args

User flags: $ARGUMENTS

## Routing

1. **No flag** → full review. Spawn **all 8** subagents **in parallel** (single message, multiple `Agent` tool blocks). Each one reads the current branch diff against `main` independently.
2. **One or more flags** → spawn only the matching subagents in parallel. Map flags to subagents using the table above.
3. **`--security-heavy`** → spawn `review-security-trust` and instruct it (via the prompt) to run its deepest pass (full trust-boundary audit including admin paths, server actions, RLS).

## Pre-flight (do before spawning)

Run these in parallel via Bash so the subagents have a stable shared snapshot of the diff scope:

```bash
git --no-pager status --short
git --no-pager diff --stat main...HEAD
git --no-pager log --oneline main..HEAD
```

If `main` is not the upstream tracking branch, use `origin/main`. If the branch is already a PR, also fetch:

```bash
gh pr view --json number,title,baseRefName,headRefName,files 2>/dev/null || true
```

Confirm in one short sentence which branch / how many commits / how many files are in scope before dispatching.

## Dispatch

Each subagent prompt should:
1. State the branch + commit count + files-changed count (from pre-flight).
2. Note any `--security-heavy` or other intensifier flags.
3. Tell the agent to focus only on its area and follow its own output format.

Use the `Agent` tool with `subagent_type` set to the matching subagent name (e.g. `review-architecture-boundaries`). Run them in **a single message with multiple tool blocks** so they execute concurrently.

## Aggregation

After all dispatched subagents return:

1. Print a one-line **per-subagent verdict**: subagent → `PASS` | `findings: <count>` | `escalated: <count>`.
2. Group findings by **severity** (blocker / important / nice-to-have), not by subagent. Each finding shows `[area]` tag, file:line, and the recommendation.
3. List **escalations separately** at the top — these are decisions that need user approval before any auto-fix.
4. End with a **suggested next step**:
   - All `PASS` → "Ready to ship. Suggest `/ship` or `gh pr create`."
   - Blockers present → "Fix N blockers, then re-run `/review-before-pr` on the affected areas."
   - Only nice-to-haves → "Safe to ship; track these as follow-ups."

## Output format

```
## /review-before-pr summary

Branch: <branch>  ·  <N commits>, <M files>  ·  base: main

### Verdicts
- review-architecture-boundaries: <verdict>
- review-correctness-state-flow:  <verdict>
- ... (one per dispatched subagent)

### Escalations (need user decision)
- [area] file:line — <one line>

### Blockers
- [area] file:line — <one line>

### Important
- [area] file:line — <one line>

### Nice-to-have
- [area] file:line — <one line>

### Next step
<one sentence>
```

## Constraints

- Do not auto-apply structural changes (file moves, schema rewrites, public API renames). Subagents own that decision per their definitions.
- Do not run `gh pr create` or `git push` from this command. That belongs to `/ship` (if available) or explicit user request.
- Do not wait for one subagent's output to dispatch the next — the whole point of multi-axis review is parallelism.
- If the diff is empty (`git diff main...HEAD` returns nothing), say so and exit without dispatching.
