---
name: ship
description: |
  MANUAL TRIGGER ONLY: invoke only when user types /ship.
  Full Git shipping workflow — from unstaged changes to a clean, merged-ready PR.
  Handles: git add, branch creation (with meaningful name), conventional commit,
  push, draft PR creation, CI monitoring and fixing, CodeRabbit comment triage
  (auto-fix reasonable ones, dismiss false positives with explanation, escalate
  architectural issues). Loops until all CI checks are green and all actionable
  review comments are resolved. Use when the user says "ship this", "commit and PR", "push and open a PR", "send this for review", "submit my changes", or anything that implies taking local changes all the way to a reviewable pull request.
  Proactively suggest after any significant code change session.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# Ship Skill

Takes your working directory from unstaged changes to a clean draft PR, then loops
until all CI checks are green and all CodeRabbit comments are resolved.

---

## Phase 0: Sanity Checks

Before touching anything, orient yourself:

```bash
# Confirm we're inside a git repo
git rev-parse --show-toplevel

# Check current branch and status
git status
git branch --show-current

# Confirm gh CLI is available
gh --version

# Confirm we're authenticated
gh auth status
```

If `gh` is not installed or not authenticated, halt and tell the user:
> "`gh` (GitHub CLI) is required. Install: https://cli.github.com — then run `gh auth login`."

Check if there are any changes to ship at all (`git status`). If the working
tree is completely clean and there are no staged changes, halt and ask the user
what they want to ship.

---

## Phase 1: Stage Changes

Review what's changed:

```bash
git diff --stat
git diff --cached --stat
```

Run `git add -A` to stage everything unless the user has already partially staged
changes (check `git status`). If partially staged, confirm with the user whether
to add the unstaged files too before proceeding.

---

## Phase 2: Branch

Check if we're already on a feature branch (i.e., not `main` or `master`):

```bash
git branch --show-current
```

**If on `main`/`master`:** Create a new branch. Derive a meaningful name from the
staged diff:

```bash
git diff --cached --stat
git diff --cached -- . | head -200
```

Use the diff summary to generate a branch name following this pattern:
`<type>/<short-slug>` where type is one of: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.

Examples: `feat/user-auth-jwt`, `fix/null-pointer-payment`, `chore/update-deps`

```bash
git checkout -b <branch-name>
```

**If already on a feature branch:** Keep it. Do not rename.

---

## Phase 3: Commit

Write a conventional commit message derived from the staged diff.

Format:
```
<type>(<optional-scope>): <short imperative summary>

<optional body: what changed and why, not how>

<optional footer: breaking changes, issue refs>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

Rules:
- Subject line ≤ 72 chars, imperative mood ("add" not "added")
- Body only if the why isn't obvious from the diff
- Reference issues if context is clear from the diff (e.g., `Closes #42`)

```bash
git commit -m "<message>"
```

---

## Phase 4: Push

```bash
git push -u origin <branch-name>
```

If push is rejected due to diverged history (non-fast-forward), see
**[Appendix: Handling Diverged Branch]** before proceeding.

---

## Phase 5: Create Draft PR

Generate PR title and body from the branch name, commit history, and diff:

```bash
git log main..HEAD --oneline
git diff main..HEAD --stat
```

**Title:** Conventional format mirroring the primary commit.
Example: `feat(auth): add JWT-based user authentication`

**Body template:**
```markdown
## Summary
<2-4 sentences describing what this PR does and why>

## Changes
<bullet list of key changes derived from diff --stat and commit log>

## Testing
<what was tested or how to verify — infer from test files changed if any>
```

Create as **draft** PR:

```bash
gh pr create \
  --title "<title>" \
  --body "<body>" \
  --draft \
  --base main
```

Print the PR URL. Save the PR number for polling later.

---

## Phase 6: CI + CodeRabbit Loop

This is the main loop. Repeat until **all CI checks pass** AND **no unresolved
actionable comments remain**.

### 6a. Wait for CI

```bash
# Poll every 30 seconds, up to 20 minutes
gh pr checks <pr-number> --watch
```

Or manually poll:
```bash
gh pr checks <pr-number>
```

States to handle:

| State | Action |
|-------|--------|
| All green ✅ | Proceed to 6b |
| Any pending ⏳ | Wait 30s, re-poll |
| Any failed ❌ | Go to **[CI Failure Triage]** |

**Max wait:** 20 minutes. If still pending after 20 min, surface to user:
> "CI has been running for 20 minutes without completing. Check for stuck runners:
> `gh run list --branch <branch>`"

### 6b. Triage CI Failures

Read the full logs for each failed check:

```bash
# List runs
gh run list --branch <branch-name> --limit 5

# Get details for the failing run
gh run view <run-id> --log-failed
```

For each failure:

1. **Read the error carefully.** Identify root cause (test failure, lint error,
   build error, type error, missing env var, etc.)

2. **Categorize:**
   - **Our code is broken** → fix it (see fix guidelines below)
   - **CI config issue** → fix the workflow file if clearly wrong
   - **Flaky test** (non-deterministic, network-dependent, timing) → re-run once:
     `gh run rerun <run-id> --failed`. If it fails again, treat as real failure.
   - **Main is broken** → See **[Appendix: Main Is Broken]**

3. **Fix and recommit:**
   After fixing, stage and commit with a `fix:` or `ci:` conventional commit,
   then push. The CI loop restarts automatically.

**CI fix guidelines:**
- Fix the actual root cause, not just suppress the error
- If a test is legitimately wrong (tests outdated behavior), update the test
  with a comment explaining why
- If CI would benefit from a new check (e.g., missing lint step, no test for
  a new module), add it and note it in the next commit message

### 6c. Triage CodeRabbit Comments

After CI is green, fetch all open review comments:

```bash
gh pr review list <pr-number>
gh api repos/{owner}/{repo}/pulls/<pr-number>/comments \
  --jq '.[] | {id: .id, path: .path, line: .line, body: .body, resolved: .resolved}'
```

Or use:
```bash
gh pr view <pr-number> --comments
```

For each unresolved comment from CodeRabbit:

#### Decision Framework

Read the full comment. Then decide:

**→ ACT on it if:**
- It identifies a real bug, edge case, or correctness issue
- It flags a security concern (injection, unvalidated input, etc.)
- It suggests a simplification that genuinely improves readability
- It catches a missing error handler or null check
- It points out a performance issue with a clear fix

**→ DISMISS with explanation if:**
- It's a false positive (e.g., flags a pattern that is intentionally used)
- It conflicts with another comment and the alternative is clearly worse
- It's a style preference that contradicts the project's existing conventions
- It suggests adding abstraction that would make the code harder to follow
- It's a nitpick that doesn't affect correctness, readability, or performance

**→ ESCALATE to user if:**
- The fix requires restructuring more than ~50 lines or touching multiple files
  in a non-mechanical way (architectural change)
- You're genuinely uncertain which of two conflicting approaches is better

**Conflicting comments:** When two comments suggest opposite things
(e.g., "extract this" vs "inline this"), reason which is better given:
1. How often this code path is called
2. Whether the extracted unit has a single clear responsibility
3. What the surrounding code style already does

Pick the better one, fix it, dismiss the other with a comment explaining the tradeoff.

#### Applying Fixes

Fix the code, then stage and push:

```bash
git add -A
git commit -m "fix: address CodeRabbit review comments"
git push
```

After pushing, CI re-runs. Return to **Phase 6a**.

#### Resolving / Dismissing Comments

After pushing fixes, reply to resolved comments via the API or CLI:

```bash
# Reply to a specific review comment
gh api repos/{owner}/{repo}/pulls/<pr-number>/comments/<comment-id>/replies \
  -f body="Fixed in <commit-sha>."

# For dismissed false positives:
gh api repos/{owner}/{repo}/pulls/<pr-number>/comments/<comment-id>/replies \
  -f body="Not acting on this: <brief technical reason>."
```

### 6d. Loop Exit Condition

Exit the loop when **both** are true:
1. `gh pr checks <pr-number>` shows all checks as `pass`
2. No unresolved actionable CodeRabbit comments remain

Then print a final summary (see Phase 7).

---

## Phase 7: Done — Hand Off to User

Print a clean summary:

```
✅ PR Ready for Review

Branch:  <branch>
PR:      <url>
Status:  Draft — ready to mark as ready-for-review when you're happy

CI:      All checks green
Review:  All CodeRabbit comments resolved or dismissed

Commits this session:
  <git log main..HEAD --oneline output>
```

Ask the user:
> "PR is clean and draft. Want me to mark it as ready-for-review now? (`gh pr ready <pr-number>`)"

Do not mark it ready without explicit confirmation.

---

## Appendix: Handling Diverged Branch

If `git push` fails because the branch has diverged from remote:

```bash
git fetch origin
git log --oneline HEAD..origin/<branch>  # what's on remote that we don't have
```

If the remote commits are ours (e.g., from a previous session):
```bash
git rebase origin/<branch>
git push
```

If the remote has someone else's commits on our feature branch (unusual):
Surface to user and halt. Do not force-push without confirmation.

---

## Appendix: Main Is Broken

If CI fails and the root cause exists in `main` (not in our diff):

```bash
# Verify: does the failure exist on main independent of our changes?
git stash
git checkout main
git pull
# Check if the same CI failure exists on main's last green run
gh run list --branch main --limit 5
```

If confirmed broken on main independently of our changes:
1. Restore our branch: `git checkout <branch> && git stash pop`
2. **Halt** and report to user:
   > "CI is failing due to a pre-existing issue on `main` (not caused by this PR).
   > Specifically: `<failure summary>`. You'll need to fix `main` first, or someone
   > else needs to. I've kept your branch intact."
3. Do **not** commit to main. Do **not** attempt to fix main.

---

## Appendix: Suggested CI Additions

During CI triage, if you notice the repo is missing beneficial checks, propose
them **after** the PR is clean, not during the fix loop. Examples worth suggesting:

- No linter in CI but linter config exists locally → suggest adding lint step
- No test coverage check → suggest adding coverage threshold
- New file type introduced (e.g., first `.proto` file) → suggest schema lint
- Secrets/credentials in diff → suggest adding secret scanning

Propose via a follow-up message to the user, not as an autonomous commit.