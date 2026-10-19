---
name: ship
description: |
  MANUAL TRIGGER ONLY: invoke only when user types /ship.
  Full Git shipping workflow — from unstaged changes to a clean, merged-ready PR.
  Handles: git add, branch creation (with meaningful name), conventional commit,
  push, draft PR creation, CI monitoring and fixing, an always-on Codex review
  loop (`@codex review` with a change brief, iterated until Codex approves the
  current head, every finding judged on its merits, not blindly applied),
  CodeRabbit comment triage (auto-fix reasonable ones, dismiss false positives
  with explanation, escalate architectural issues). Loops until all CI checks are
  green, Codex approves, and all actionable review comments are resolved. Use when the user says "ship this", "commit and PR", "push and open a PR", "send this for review", "submit my changes", or anything that implies taking local changes all the way to a reviewable pull request.
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
until all CI checks are green, **Codex has approved the current head**, and all
CodeRabbit comments are resolved. The Codex review is not optional and is never
skipped; neither is our own judgment: Codex is a second reviewer, not the authority.

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

Stage **explicit paths** — the files this session changed — never `git add -A` /
`git add .`. The checkout is shared: a blanket add once swept 67 of the user's untracked
files into a pushed commit (`f6072383` L961-969) and another silently deleted
`apps/docs/mobile/` (`56cfd62e` L3942). If the user has already partially staged changes
(check `git status`), or untracked files exist that you did not create, confirm with the
user before adding them. Then check `git diff --cached --stat` and
`git diff --cached --diff-filter=D --name-only` — every staged deletion is one you meant.

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
```text
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

**Tier first.** `node scripts/dev/risk-tier/risk-tier.mjs` prints the review tier
of the branch (low / medium / high) and why. The tier sets the depth of the 6c loop
and what the owner reads (`docs/REVIEW_TIERS.md`). A fix-forward PR runs at low
depth when its "Regression of" PR merged in the last 14 days, it touches only files
that PR touched, and its own tier is not high.

**Body:** fill every section of `.github/PULL_REQUEST_TEMPLATE.md`:
- **Summary**, **Changes**: what the PR does and why; key changes from the diff.
- **How to review** (medium and high): the owner reads this instead of the whole
  diff. What behaves differently for a user; the 2-3 places the risk sits, as
  `file:line`, and what could go wrong there; what the evidence covers and what it
  cannot see. Write it for someone who has not read the code since last week. Low
  tier: "Low tier, merge on green."
- **Evidence**: each claim points at output you ran (gates, tests, screenshots of
  the screen on a device or browser, the eval result, a migration on a scratch
  database). High tier needs a real run, not only tests.
- **Risk tier**: the script's tier and reasons.
- **Regression of**: the PR whose defect this fixes, or "none". It is how fix-forward
  breakage gets counted, so never leave it blank.
- **How to revert**: revert, or the flag / kill switch; name any migration or data
  change a revert does not undo.

Create as **draft** PR, labelled with its tier:

```bash
gh pr create \
  --title "<title>" \
  --body-file <scratchpad>/pr-body.md \
  --draft \
  --base main \
  --label "risk:<tier>"
```

Print the PR URL. Save the PR number for polling later.

**Before leaving this phase, write the Codex brief** (used in 6c) while the diff is
fresh. It is also our own review of the change, so do it honestly:

1. **What changed and why** — 2-4 sentences in plain words: the behavior before,
   the behavior after, and the reason.
2. **Where it could break** — the 2-5 spots *we* consider riskiest (a boundary
   condition, a cache, a migration, a trust boundary, a concurrency path), each
   with file path and what to check. Name the function, field or invariant.
3. **Out of scope** — anything deliberately not changed, so Codex does not flag it
   as missing.

If writing point 2 surfaces a real bug, fix it now, before asking Codex. We do
not outsource finding our own bugs.

---

## Phase 6: CI + Codex + CodeRabbit Loop

This is the main loop. Repeat until the exit condition in 6e holds: **all CI
checks pass**, **Codex has approved the current head**, and **no unresolved
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
| All green ✅ | Proceed to 6c (Codex) |
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

### 6c. Codex Review Loop (always runs)

Codex is the `chatgpt-codex-connector[bot]` GitHub app. It reviews on demand when
the PR gets a comment starting with `@codex review`; drafts are fine.

#### Request a review

Post the brief from Phase 5 as a PR comment. The first line must be exactly
`@codex review`; the rest tells Codex what the change is and where to look:

```bash
REQUEST_SHA=$(git rev-parse HEAD)
REQUEST_URL=$(gh pr comment <pr-number> --body "@codex review

**Review commit:** $REQUEST_SHA

$(cat <<'BODY'
**Change:** <what changed and why, 2-4 sentences>

**Please check in particular:**
- `<path>`: <the invariant or edge case to verify>
- `<path>`: <...>

**Out of scope:** <what was deliberately left alone>
BODY
)")
```

On every later round, the comment names what changed since the last round:

```text
@codex review

**Review commit:** <full HEAD sha>

Round <n>. Since the last review (`<old-sha>`):
- Fixed: <finding> in `<sha>`
- Not changed, by design: <finding>: <one-line reason> (replied on the thread)
Please re-check <the area the fix touched>.
```

#### Wait for the verdict

Codex reacts 👀 while it runs (usually 2-10 minutes) and keeps a
`## Codex Review Summary` status table comment up to date. That table is status,
not a verdict. **Do not push while a round is running**: a 👍 carries no commit,
so it only counts if `HEAD` is still the commit the round was requested on.
Never use foreground `sleep`; run a background poll or a Monitor until a verdict
on the current head appears. The verdict is one of:

- **Approved**: an issue comment from `chatgpt-codex-connector[bot]` containing
  `Codex Review: Didn't find any major issues` whose `**Reviewed commit:**`
  matches `git rev-parse --short=10 HEAD`. The comment opens with an HTML marker
  (`<!-- codex-review-receipt:v1 -->`), so match with `contains`, not
  `startswith`. The bot's `+1` lands on the PR itself, not on our request, and
  carries no commit: treat it as a hint to look for the comment, never as the
  approval.
- **Findings**: a bot review whose `**Reviewed commit:**` is `HEAD`. Its findings
  are the bot's inline comments with `original_commit_id == HEAD` (tagged
  P0/P1/P2/P3). Never match inline comments on `commit_id`: GitHub moves it
  forward on older comments that still apply.

```bash
HEAD_SHA=$(git rev-parse HEAD)
BOT='chatgpt-codex-connector[bot]'
# Approval comment for this head (ignores the status table)
gh api repos/{owner}/{repo}/issues/<pr-number>/comments --paginate \
  --jq ".[] | select(.user.login==\"$BOT\" and (.body | contains(\"Didn't find any major issues\")) and (.body | contains(\"${HEAD_SHA:0:10}\"))) | {created_at, body: .body[0:200]}"
# Findings raised on this head. Filter on original_commit_id: GitHub moves
# commit_id forward on older comments that still apply, which would resurface
# findings from earlier rounds as if they were new.
gh api repos/{owner}/{repo}/pulls/<pr-number>/comments --paginate \
  --jq ".[] | select(.user.login==\"$BOT\" and .original_commit_id==\"$HEAD_SHA\") | {id, path, line, body}"
```

An approval for an **older** commit does not count. If nothing arrives after
20 minutes, re-post the `@codex review` comment once; if it is silent again, tell
the user Codex is not responding and continue with 6d, leaving the loop open.

#### Judge every finding ourselves

Codex findings are claims to verify, not orders. For each one:

1. **Reproduce the reasoning.** Read the code it points at and trace a real
   caller or input to the failure. Write a failing test when the path is real.
2. **Decide**, using the 6d framework (ACT / DISMISS / ESCALATE):
   - Real bug, real path → fix at the root cause, add or extend a test.
   - Real path, but the fix costs more than it prevents, or contradicts a repo
     rule (`AGENTS.md`, a decision log entry) → do not change the code; reply on
     the thread with the path traced and why.
   - Wrong (misread the code, flags intended behavior) → reply with the evidence
     (file:line, test name) and resolve.
   - Architectural or ambiguous → escalate to the user.
   - **Pipeline PRs** (any file under `lib/ai/prompts/`, `lib/ai/pipeline/`,
     `lib/ai/matching/`): sort the finding before touching code (AGENTS.md "Code
     Review Rules").
     - *Code bug*: a term matched without a word boundary (the #247 `miến`/`miếng`
       class), NFC/NFD, two prompt rules that contradict, wrong arithmetic or
       units in a rule, a deadline / cancellation / dropped-field / mass-conversion /
       provider-routing path. Fix it in this PR with a unit test or a
       frozen-capture replay.
     - *Food judgment*: the claim is "input X should yield Y" and only the model's
       output on a meal can confirm it (a keyword-list entry such as "súp", sugar
       implied in iced tea, how a dish count splits, which row state to pick). Do
       not patch it in the round. Write the meal as an arena case in the train
       format of `~/Developer/kallo-meal-arena/climb/arena-train/meals.json`
       (`{lang, text, components: [{name, role, grams, required}]}`) under
       `arena-train/review-cases/pr<n>.json` with the comment id (never into
       test30), and reply `Eval case: pr<n>/<id>, judged on the arena, not patched
       here.` Before un-drafting, the PR body's Evidence carries the arena result
       before → after and pass/fail per review case. A server-side change uses the
       frozen-capture replay (no DB, no LLM); a prompt change needs a Call 1/2 run,
       and any paid run needs the owner's go-ahead first. A change inside the ±1.5
       first-pick noise per 200 meals is dropped, whatever the thread argued.
       Review cases join `meals.json` only after a gold-curation batch.
     - Codex re-raising an eval-routed finding gets the case id again, not a patch.
3. **Sweep the class.** A finding usually names one site of a class of bug (a
   missing deadline check, a substring match, an unhandled null). Name the class,
   search the whole diff and its callers for it (`grep`, not memory), and fix every
   site in this round. Say in the reply which sites were swept. #430 spent five
   rounds finding one deadline site at a time. If our own brief named a risk Codex
   did not comment on, check it again ourselves before treating silence as
   clearance.

Every Codex thread gets a reply (`Fixed in <sha>.`, `Not changing: <reason>.`,
`Eval case: <id>.`, or `Pre-existing: <ttr task>.`) and is then **resolved**
before the next round is requested. `main` requires conversation resolution, and an
open thread at merge is how #419's finding shipped and came back as #420.

```bash
# Unresolved threads, with the first comment's id to match against our replies.
# --paginate follows $endCursor, so a PR with over 100 threads is read whole.
gh api graphql --paginate -F n=<pr-number> -f query='
  query($n: Int!, $endCursor: String) {
    repository(owner: "VoMinhKhoii", name: "Kallo") { pullRequest(number: $n) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved
          comments(first: 1) { nodes { databaseId author { login } } } }
  } } } }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'
# Resolve one after replying
gh api graphql -f id=<thread-node-id> -f query='
  mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }'
```

Codex sometimes answers a thread reply by running its own cloud task and posting
a `### Summary` comment with a commit and "PR metadata" on another branch. That
patch is a suggestion: read it, take any idea that holds up into our own commit,
and never merge or cherry-pick its branch.

#### Iterate until approval

Commit fixes with explicit paths (`fix: address Codex review round <n>`), push,
wait for CI (6a), then request the next round. Repeat until the bot approves the
**current** head.

**Depth by tier.** Low tier gets at most two GitHub rounds: if the first round has
findings, fix them and request a second; after the second, fix anything it raised
and stop, even without an approval, unless it found a P0 or P1 (then the PR loops
like medium). Medium and high loop until approval.

**From round 3 on, change the round, not just the code.** Before the third and
every later `@codex review`:
1. List every finding so far by class. Sweep each class across the whole diff and
   its callers (step 3 above), so this round fixes classes, not sites.
2. Run the local Codex pass (Phase 3b) on the fixed head, and handle its findings
   before asking GitHub again. On a low or medium tier PR, skip it when the fixes
   since the last round are a few lines (the pass costs several minutes of model
   usage); a high tier PR always runs it.
3. Ask for a narrower review: the request names the last reviewed commit, asks
   Codex to review `git diff <last-reviewed-sha>..HEAD` and the callers of what it
   changed, and lists the findings already answered so they are not raised again.

Keep looping while rounds find real bugs; the round count alone is never a reason
to stop. Do not cave to win the approval either. Stop and put the positions to the
user only when:
- Codex re-raises a finding we rejected with evidence (do not change the code just
  to quiet it);
- a finding needs a product or design decision;
- two rounds in a row found only new sites of classes already swept, which means
  the approach itself may need rethinking.

### 6d. Triage CodeRabbit Comments

After CI is green, fetch all open review comments:

```bash
gh pr view <pr-number> --comments
gh api repos/{owner}/{repo}/pulls/<pr-number>/comments \
  --jq '.[] | {id: .id, path: .path, line: .line, body: .body}'
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
git add <the files you fixed>      # explicit paths, never -A
git commit -m "fix: address CodeRabbit review comments"
git push
```

After pushing, CI re-runs. Return to **Phase 6a**, and request a fresh Codex round
(6c): any push after Codex's approval invalidates it.

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

Then resolve each answered thread (the GraphQL commands in 6c).

### 6e. Loop Exit Condition

Exit the loop when **all** are true:
1. `gh pr checks <pr-number>` shows all checks as `pass`
2. Codex has approved the current `HEAD` (6c), or the user explicitly accepted
   an open dispute, or a low-tier PR has used its two rounds and every finding is
   fixed (the summary says the last fixes were not re-reviewed)
3. Every Codex and CodeRabbit thread has a reply and is resolved (the 6c query
   returns nothing); an open dispute the user is deciding stays open and is named
   in the summary
4. No unresolved actionable CodeRabbit comments remain

Then print a final summary (see Phase 7).

---

## Phase 7: Done — Hand Off to User

Print a clean summary:

```text
✅ PR Ready for Review

Branch:  <branch>
PR:      <url>
Status:  Draft — ready to mark as ready-for-review when you're happy
Tier:    <low|medium|high> — <low: merge on green | medium: read "How to review"
         and the evidence | high: also read the diff of <high-risk files>>

CI:      All checks green
Codex:   Approved on <sha> after <n> rounds
         (or: Not approved; user accepted open dispute(s): <finding>, on <date>)
         (or: Low tier, two rounds used; fixes in <sha> not re-reviewed)
         Fixed: <count>  Disputed (with reasons): <count>
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
