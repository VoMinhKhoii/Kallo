---
name: kship
description: |
  MANUAL TRIGGER ONLY: invoke only when user types /kship. (Renamed from /ship: Claude Code 2.1.330 took that name for its own built-in.)
  Full Git shipping workflow — from unstaged changes to a clean, merged-ready PR.
  Handles: git add, branch creation (with meaningful name), conventional commit,
  a local cross-model review before the first push (up to three bug rounds by the other
  model family: Gemini 4 Neon for Claude sessions, Claude Opus 5.5 for Gemini sessions,
  each run as the code-review plugin's parallel reviewers plus validators; a Fable
  thermo-nuclear structure review and a Fable regression check), push (behind a
  pre-push gate hook), draft PR creation, CI monitoring and fixing, PR review rounds (normally
  up to three, more only while real bugs turn up; rounds 1 and 2 Neon and Claude via `@claude review`, waiting for both; later
  rounds the other family; Codex stays documented as paused; every finding judged on its
  merits),
  CodeRabbit comment triage (auto-fix reasonable ones, dismiss false positives
  with explanation, escalate architectural issues). Loops until all CI checks are
  green, the head is approved, and all actionable review comments are resolved. Use when the user says "ship this", "commit and PR", "push and open a PR", "send this for review", "submit my changes", or anything that implies taking local changes all the way to a reviewable pull request.
  Proactively suggest after any significant code change session.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Agent
---

# Ship Skill

Takes your working directory from unstaged changes to a clean draft PR, then loops
until all CI checks are green, **the last review round found nothing we fix on the
current head** (Gemini 4 Neon and Claude; Codex is paused and not used for now), and all
CodeRabbit comments are resolved. The PR review is not optional and is never skipped; neither is our own
judgment: the reviewers are second opinions, not the authority.

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

## Phase 3b: Local Review (every PR, before the first push)

Before GitHub ever sees the branch, it is reviewed locally in this order (any
tier, test-only and docs-only PRs included; #630 skipped it and said nothing):
**up to three bug rounds**, **one step-back pass** only if round 3 still finds
real bugs, **one Fable structure review** (`thermo-nuclear-code-quality-review`),
then **one regression check** on the structure fixes. If that check is clean, we
push and open the PR. The shape follows Anthropic's write-up of its own review loop:
full review first, diff-only re-review after it, findings reported as classes, no
repeats, and a step back after three rounds
(<https://claude.dev/blog/solving-code-review-at-anthropic/>). On record, one local
pass found 8 defects the GitHub review loop had missed.

**Which model (cross-model rule).** The local bug rounds and the step-back pass run on
the **opposite model family** from the session doing the work; the structure review
and the regression check always run on **Fable**:

| Session | Bug rounds, step-back pass | Structure review | Regression check |
|---------|---------------------------|------------------|------------------|
| Claude (Claude Code / Opus / Sonnet) | Gemini 4 Neon | Fable | Fable |
| Gemini (Antigravity / Gemini) | Claude Opus 5.5 | Fable | Fable |

- **Codex Sol & Astra are paused for now** — their commands remain in
  `.claude/skills/kship/codex-paused.md`, but do not invoke Codex.

When a pass fails, these rules apply in order:

1. **The run failed once** (a `FAILED` line from `neon-review.sh`, a non-zero exit, an
   empty file, `jetski: no output produced … required the "command" / "read_file"
   permission`, or output that is not a review): rerun it once on the same pass. After a
   tool refusal the rerun may add a read-only command (never one that writes; no pipes or
   chains) or a folder with no secrets in it, such as a package cache, to the allowlist in
   the script. Never add a folder that holds credentials or env files: `~/.gemini` itself,
   `~/.claude`, `~/.ssh`, `~/.config`, `~/.aws`, or any checkout of the repo (its
   `.env.local`).
2. **It failed twice, the CLI is missing, or quota is exhausted** (a `QUOTA` line, or
   Claude's usage-limit message; never retry these): the bug rounds switch to the other
   family for the rest of this `/kship`, and Evidence says the reviewer is now the
   session's own family and why. Do not fall back to Codex while Codex is paused.
3. **Neither can run**: record `"Local review did not run: <which pass>: <reason>"` under
   Evidence in the PR body and continue. A pass that did not run is never a clean pass.

**How each pass runs.** Every pass runs in the background (3-15 minutes; wait for the
task notification, never a foreground `sleep`). Round 1 has no pass file: leave
`<scratchpad>/pass-<name>.md` out of the command. Both scripts review a throwaway worktree
of the pinned commit with read tools only, and macOS `sandbox-exec` refuses writes to the
repo. `CK` is the branch checkout's absolute path and `<pinned-sha>` the commit recorded
for this pass.

**A Neon round** (Claude sessions) has the shape of Anthropic's code-review plugin, every
agent on Neon:

1. Four Neon reviewers in parallel (two on `AGENTS.md` / `CLAUDE.md` rules, one on
   obvious bugs in the diff alone, one on problems in the introduced code):
   ```bash
   "$CK"/.claude/skills/kship/neon-review.sh find "$CK" <pinned-sha> \
     <scratchpad>/neon-<name> <scratchpad>/review-brief.md [<scratchpad>/pass-<name>.md]
   ```
2. Read the four `find-*.md` files, merge duplicates (the same claim at the same place),
   and write each remaining finding block to its own file, `<scratchpad>/neon-<name>/F<n>.md`.
3. One Neon validator per finding, in parallel; skip this when step 2 found nothing:
   ```bash
   "$CK"/.claude/skills/kship/neon-review.sh verify "$CK" <pinned-sha> \
     <scratchpad>/neon-<name> <scratchpad>/review-brief.md <scratchpad>/neon-<name>/F*.md
   ```
   A finding counts only when its `F<n>.verdict.md` starts with `VALID`.

**A Claude Opus 5.5 round** (Gemini sessions) is one command; the prompt runs the
plugin's own agents (a Haiku file list, a Sonnet summary, four reviewers, a validator per
finding) and returns only validated findings:
```bash
"$CK"/.claude/skills/kship/claude-pass.sh claude-opus-5-5 "$CK" <pinned-sha> \
  <scratchpad>/local-review-<name>.md "$CK"/.claude/skills/kship/claude/review.md \
  <scratchpad>/review-brief.md [<scratchpad>/pass-<name>.md]
```

Both prompts send reviewers to the "Code Review Rules" section of `AGENTS.md` for what
counts as a finding, the severity bar and what not to report. A non-zero exit is a failed
pass, even when the output file has text in it: rerun it by the rules above.

- **Pin the commit.** Just before launching any pass (Fable's too), record
  `git rev-parse HEAD`: the commit that pass reviews. Fixes committed after the
  launch are what the next pass reviews.
- **Pass files.** Every pass after round 1 is diff-only and gets its own
  `<scratchpad>/pass-<name>.md`, never lines appended to `review-brief.md`, which
  must still mean the whole branch when Phase 6c reuses it. A pass file holds
  `Scope: git diff <previous-pass-sha>..HEAD` (the prompt adds the callers), an
  "Already answered" list of every earlier pass's findings (finding, `Fixed in
  <sha>` or `Not changing: <reason>`) so the reviewer does not raise them again, and what
  that pass's step below adds.
- **Judge every finding** as in 6c ("Judge every finding ourselves"), with one
  difference: a finding that needs a product or design call is listed in the PR
  body as a decision only the owner can make (any tier), not asked mid-review.
  Commit fixes with explicit paths.

1. **Write the brief now**, the three parts listed under Phase 5 (what changed and
   why, where it could break, out of scope), to `<scratchpad>/review-brief.md`. If
   writing "where it could break" surfaces a bug, fix it first.
2. **Round 1** (cross-model reviewer: Opus 5.5 for Gemini sessions, Neon for
   Claude sessions; pass `1`) reviews the whole branch. The brief's first line is
   `Base: origin/main`.
3. **Rounds 2 and 3** (same cross-model reviewer; passes `2` and `3`). Each runs
   only when the round before found a real bug (a finding we fixed, not one we
   rejected); a round with none ends the bug rounds.
4. **After round 3, step back; do not run a round 4.** If round 3 still found a
   real bug, first ask whether the findings across all three rounds share one cause
   (the same class reappearing at new sites, or an approach that keeps leaking).
   If they do, change the approach, not the cases. Then fix, commit, and run **one
   step-back pass** (pass `step-back`, Scope from round 3's commit) on the active
   cross-model reviewer (Astra is paused). Its pass file adds a "Step back"
   section: the classes the three rounds found, the shared cause, and the approach
   change made for it (or why none was needed), so the reviewer judges the new
   approach, not just the new lines.
5. **One Fable structure review** of the whole branch, once the bug rounds are
   done. Run it from either session:
   ```bash
   "$CK"/.claude/skills/kship/claude-pass.sh claude-fable-5-2 "$CK" <pinned-sha> \
     <scratchpad>/local-thermo.md "$CK"/.claude/skills/kship/claude/structure.md \
     <scratchpad>/review-brief.md
   ```
   Apply a finding when the restructuring keeps
   behavior the same and the gates stay green; reject it with the reason otherwise.
   Commit the structure fixes separately (`refactor: ...`).
6. **One Fable regression check** on the structure fixes only (pass `regression`,
   Scope from Fable's commit), skipped when step 5 changed nothing:
   ```bash
   "$CK"/.claude/skills/kship/claude-pass.sh claude-fable-5-2 "$CK" <pinned-sha> \
     <scratchpad>/local-regression.md "$CK"/.claude/skills/kship/claude/regression.md \
     <scratchpad>/review-brief.md <scratchpad>/pass-regression.md
   ```
   - **No findings** → push and open the PR (Phase 4 onward).
   - **A real regression** → revert the restructuring that caused it unless the fix
     is a few lines, then run this check once more on that fix (pass
     `regression-2`). Push after that; the GitHub loop (6c) covers what remains.

Record each pass's finding count (bug rounds, step-back if it ran, Fable structure
review, regression check) under Evidence in the PR body, and which model ran each
one (**Claude Opus 5.5**, **Gemini 4 Neon** or **Fable**).

A local round (Opus 5.5 or Neon) that already ran on this exact commit with the
same brief (for example during `grill-your-own-work`), with its findings handled,
counts as round 1; do not repeat it.

If no reviewer can run a pass (rule 3 above), write "Local review did not run:
<which pass>: <reason>" under Evidence in the PR body and continue. A pass that did
not run is never a clean pass.

---

## Phase 3c: Real Run (changes a user can see)

A change a user can see is opened in a real browser or simulator before the first
push, and the PR shows the screenshots. More than half of the fixes for something an
earlier PR broke came within a day, from exactly this kind of run (#307, #353,
#241, #411). Setup, options and the iOS sign-in: `docs/REAL_RUN_EVIDENCE.md`.

- **Web** (pages and components under `app/`, `components/`, `hooks/`,
  `messages/`, styles): start `bun run dev` from the branch's checkout, then
  capture every route the change reaches:

  ```bash
  node --env-file=.env.local scripts/dev/evidence/capture-web.mjs \
    --out <scratchpad>/evidence /en/logging /en/dashboard
  ```

  It signs in as the dev evidence account, captures phone and desktop width, and
  fails on console errors, failed requests, sideways scrolling, broken images or a
  lost session. An issue that also happens on main goes in `--allow '<text>'` and
  under Evidence as pre-existing. A state the route alone does not reach (an open
  sheet, an error toast): sign Playwright MCP in with `sign-in.mjs` and screenshot it.
- **iOS** (`apps/mobile-flutter/lib/`): mark the dev server's log, run the dev
  app on the simulator with `tool/run_dev.sh` (its log kept in a file), drive it
  by label with `drive-ios.mjs` (never by coordinates), and capture each screen
  the change reaches with `capture-ios.mjs --log <run log> --server-log <dev
  server log> <screen>`. It fails on a Flutter exception or layout overflow, or
  an `/api/v1` call that got an error status.
- **Look at every screenshot** (downscaled, AGENTS.md §8). A clean report means
  nothing crashed, not that the screen is right. Fix what is wrong, re-capture.
- **Publish**: `node scripts/dev/evidence/publish.mjs <scratchpad>/evidence`
  uploads to the `pr-evidence` branch and prints the image Markdown for Evidence.

When a run is not possible (no simulator, the dev database behind the branch's
migrations), write "Not run on <web|iOS>: <reason>" under Evidence. Changes with
nothing to see (server-only code, scripts, docs) skip this phase.

---

## Phase 4: Push

```bash
git push -u origin <branch-name>
```

A git pre-push hook (`.githooks/pre-push` → `scripts/dev/push-gates/`) runs CI's
fast gates (structure, Biome, tsc, migration timestamps, `dart format`, `flutter
analyze`, each only when the diff needs it) before any agent push, and makes git
refuse the push with the failing output. Fix the failures and push again; never
bypass it with `--no-verify`.

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
of the branch (low / medium / high) and why. The tier sets what the owner reads and
what evidence the PR carries (`docs/REVIEW_TIERS.md`); every tier loops to
approval. A fix-forward PR is reviewed as low when its "Regression of" PR merged in
the last 14 days, its product code stays within files that PR touched (new tests
and docs are fine), and its own tier is not high; the Risk tier section then says
both, e.g. "medium by path, reviewed as low: fix-forward of #N".

**Body:** fill every section of `.github/PULL_REQUEST_TEMPLATE.md`:
- **Summary**, **Changes**: what the PR does and why; key changes from the diff.
- **How to review** (medium and high): the owner reads this instead of the whole
  diff. What behaves differently for a user; the 2-3 places the risk sits, as
  `file:line`, and what could go wrong there; what the evidence covers and what it
  cannot see. Write it for someone who has not read the code since last week. High
  tier adds the decisions only the owner can make and the few diff excerpts
  (`file:line` ranges) worth their reading; the full diff stays one click away. Low
  tier: "Low tier, merge on green."
- **Evidence**: each claim points at output you ran (gates, tests, screenshots of
  the screen on a device or browser, the eval result, a migration on a scratch
  database). Say what did not run as plainly as what did; a high tier PR names what
  was not exercised in a real environment (device, browser, prod-like service).
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

**Before leaving this phase, refresh the review brief** written in Phase 3b
(`<scratchpad>/review-brief.md`, used in 6c) so it matches the head being pushed.
It is also our own review of the change, so do it honestly:

1. **What changed and why** — 2-4 sentences in plain words: the behavior before,
   the behavior after, and the reason.
2. **Where it could break** — the 2-5 spots *we* consider riskiest (a boundary
   condition, a cache, a migration, a trust boundary, a concurrency path), each
   with file path and what to check. Name the function, field or invariant.
3. **Out of scope** — anything deliberately not changed, so the reviewer does
   not flag it as missing.

If writing point 2 surfaces a real bug, fix it now, before requesting a PR review.
We do not outsource finding our own bugs.

---

## Phase 6: CI + Neon / Claude + CodeRabbit Loop

This is the main loop. Repeat until the exit condition in 6e holds: **all CI
checks pass**, **the last review round found nothing we fix on the current head**
(Codex is paused and not used for now), and **no unresolved actionable comments
remain**.

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
| All green ✅ | Proceed to 6c (the next review round) |
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

### 6c. PR Review Loop: Gemini 4 Neon + Claude (Codex paused)

A round is: ask for a review of the pushed `HEAD`, wait for it, judge every finding, fix,
reply, resolve, push. Three rounds is the norm: a round whose reviewers find nothing we fix
on the current `HEAD` ends the loop, round 3 is where we step back, and a fourth round or
later runs only while rounds still find real bugs ("From round 3 on" below).
**Codex (`@codex review`) is paused for now**; its procedure stays in
`.claude/skills/kship/codex-paused.md` and is not invoked.

**Who reviews which round:**

| Round | Claude session | Gemini session |
|-------|----------------|----------------|
| 1, 2 | Neon **and** Claude | Neon **and** Claude |
| 3, any later | Neon | Claude |

**Two reviewers, one round.** In rounds 1 and 2, start both reviewers on the same pushed
commit, then wait for **both** results (Neon's posted review and Claude's receipt) before
judging, fixing or pushing anything. Judge the two sets of findings together, fix them in
one go, and push once. Such a round is clean only when both reviewers are clean on that
commit; if one of them cannot run, the round goes on with the other and the PR says so.

- **Neon** runs on your machine: the Phase 3b Neon round (`neon-review.sh` find, merge,
  verify) on the pushed head, pass `pr-neon-<round>`, posted on the PR. Skip running it
  when a Phase 3b Neon pass already reviewed this exact commit; post that result instead.
- **Claude** runs in GitHub Actions on the Claude subscription: comment `@claude review`
  (`.github/workflows/claude-review.yml`, the code-review plugin's agents led by Opus 5.5
  at high effort, posting as `github-actions[bot]`).
- If the round's reviewer cannot run on this head (Phase 3b's failure rules, including
  `QUOTA`, or a failed Claude receipt), the other family reviews this round instead, and
  the PR says so. If neither can run, post that on the PR, stop the loop, and hand the PR
  to the user: a review that did not run is never a clean pass.

**Scope.** Round 1 reviews the whole branch with `<scratchpad>/review-brief.md`. Later
rounds are diff-only: `git diff <last-reviewed-sha>..HEAD` plus the callers of what it
changed, with the "Already answered" list, in a pass file (Neon) or the request comment
(Claude), except that round 3 reviews the whole branch again.

**Do not push while a round is running**: each verdict is tied to the commit it reviewed.
Never use foreground `sleep`; wait for the background task, or run a background poll or a
Monitor.

#### Neon's result on the PR

```bash
gh pr comment <pr-number> --body-file <scratchpad>/neon-pr-<round>.md
```

The comment starts with `**Gemini 4 Neon review** of <full sha>: <n> findings` (validated
ones only), then one line per finding: `file:line`, severity, the claim, and what we did
(`Fixed in <sha>`, `Not changing: <reason>` or `Eval case: <id>`). If Neon could not run,
the comment says so and why.

#### Claude in CI

Post the brief as a PR comment. The first line must be exactly `@claude review`:

```bash
REQUEST_SHA=$(git rev-parse HEAD)
gh pr comment <pr-number> --body "@claude review

**Review commit:** $REQUEST_SHA

$(cat <<'BODY'
**Change:** <what changed and why, 2-4 sentences>

**Please check in particular:**
- `<path>`: <the invariant or edge case to verify>
- `<path>`: <...>

**Out of scope:** <what was deliberately left alone>
BODY
)"
```

On later rounds the comment says `Round <n>. Review git diff <last-reviewed-sha>..HEAD and
the callers of what it changed.` and lists what is already answered. The run shows in
`gh run list --workflow claude-review.yml --limit 1`; the job times out after 50 minutes.
The verdict:

- **Clean:** an issue comment from `github-actions[bot]` containing
  `claude-review-receipt:v1`, the full `HEAD` sha after `**Reviewed commit:**`, and
  `Claude Review: No major issues found`; the bot also approves that commit.
- **Findings:** the receipt says `Claude Review: <n> findings (inline)`; the findings are
  the bot's inline comments with `original_commit_id == HEAD`, tagged `[P0]` to `[P3]`.
  Never match on `commit_id`: GitHub moves it forward on older comments that still apply.
- **Failed:** the receipt contains `Claude Review: failed`, most often the subscription's
  usage limit (the receipt links the run log). Neon reviews this round instead.
- **No receipt** within 50 minutes: look at the run. The comment may not have qualified
  (it must start with `@claude review`, on a PR, from an owner, member or collaborator).
  Tell the user; silence is never a clean pass.

```bash
HEAD_SHA=$(git rev-parse HEAD)
BOT='github-actions[bot]'
gh api repos/VoMinhKhoii/Kallo/issues/<pr-number>/comments --paginate \
  --jq ".[] | select(.user.login==\"$BOT\" and (.body | contains(\"claude-review-receipt:v1\")) and (.body | contains(\"$HEAD_SHA\"))) | {created_at, body}"
gh api repos/VoMinhKhoii/Kallo/pulls/<pr-number>/comments --paginate \
  --jq ".[] | select(.user.login==\"$BOT\" and .original_commit_id==\"$HEAD_SHA\") | {id, path, line, body}"
```

Record every round under **Evidence** in the PR description (Neon and Claude, never Codex
while paused).

#### Judge every finding ourselves

Reviewer findings (Gemini 4 Neon, Claude, or CodeRabbit) are claims to verify, not orders. For each one:

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
       not patch it on the reviewer's word. Write the meal as an arena case in the train
       format of `~/Developer/kallo-meal-arena/climb/arena-train/meals.json`
       (`{lang, text, components: [{name, role, grams, required}]}`) under
       `arena-train/review-cases/pr<n>.json` with the comment id (never into
       test30), and reply `Eval case: pr<n>/<id>, judged on the arena before any
       change.` Run it the way `arena-train/CLIMB.md` records: a server-side change
       uses the frozen-capture replay (no DB, no LLM); a prompt change needs a
       Call 1/2 run, and any paid run needs the owner's go-ahead first. Judge it on
       the measure the finding is about (the case's components, grams or kcal),
       case by case, plus the aggregate to catch a regression elsewhere; the ±1.5
       first-pick noise rule applies to retrieval comparisons only. Three outcomes,
       stated in the PR's Evidence before un-drafting:
       - the case fails today and a change fixes it without an aggregate
         regression → make the change, with the numbers;
       - the case already passes, or the change does not help → resolve the
         thread with the result;
       - the eval cannot run or is inconclusive → leave the case filed and ask the
         owner whether to merge without it.
       Review cases join `meals.json` only after a gold-curation batch.
     - Codex re-raising an eval-routed finding gets the case id again, not a patch.
3. **Sweep the class.** A finding usually names one site of a class of bug (a
   missing deadline check, a substring match, an unhandled null). Name the class,
   search the whole diff and its callers for it (`grep`, not memory), and fix every
   site in this round. Say in the reply which sites were swept. #430 spent five
   rounds finding one deadline site at a time. If our own brief named a risk the
   reviewers did not comment on, check it again ourselves before treating silence as
   clearance.

Every review thread gets a reply (`Fixed in <sha>.`, `Not changing: <reason>.`,
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

#### Iterate

Commit fixes with explicit paths (`fix: address review round <n>`), push, wait for CI
(6a), then start the next round with that round's reviewer(s) (table above). Stop at the
first round whose reviewers find nothing we fix on the **current** head.

**Every tier gets the same rounds.** The tier changes what the owner reads and what
evidence the PR carries, never when review stops.

**From round 3 on, change the round, not just the code.** Before the third round:
1. List every finding so far by class. Sweep each class across the whole diff and its
   callers (step 3 above), so this round fixes classes, not sites.
2. Step back: do the classes share one cause (the same class at new sites, or an approach
   that keeps leaking)? If so, change the approach, not the cases.
3. Round 3 reviews the whole branch, with a "Step back" section in its pass file or
   request: the classes found so far, the shared cause, and the approach change (or why
   none was needed). Later rounds go back to `git diff <last-reviewed-sha>..HEAD` and the
   callers of what it changed, and a whole-branch review runs again only when the
   approach changed.

Keep looping past round 3 only while rounds find real bugs. When two rounds in a row find
only new sites of classes already swept, change the approach instead of adding cases: a
different mechanism, not a longer list (on #466 the gate stopped parsing Bash commands and
used git's own pre-push hook, and the findings ended). Say so in the next request. Do not
cave to win a clean review either. Stop and put the positions to the user only when:
- a reviewer re-raises a finding we rejected with evidence (do not change the code just
  to quiet it);
- no reviewer can run on the current head;
- a finding, or a change of approach, needs a product or design decision.

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

After pushing, CI re-runs. Return to **Phase 6a**, then run the next 6c round: any
push invalidates the last clean review.

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
2. The last 6c round, on the current `HEAD`, found nothing we fix (Claude: a
   `No major issues found` receipt for `HEAD`; Neon: a posted review of `HEAD` with 0
   validated findings), or the user explicitly accepted an open dispute. No reviewer
   able to run on the current `HEAD` is not an exit: stop and hand the PR to the user
3. Every review thread (CodeRabbit, or Codex if re-enabled) has a reply and is
   resolved (the 6c query returns nothing); an open dispute the user is deciding
   stays open and is named in the summary
4. No unresolved actionable CodeRabbit comments remain

Then print a final summary (see Phase 7).

---

## Phase 7: Done — Hand Off to User

Print a clean summary:

```text
✅ PR Ready for Review

Branch:   <branch>
PR:       <url>
Status:   Draft — ready to mark as ready-for-review when you're happy
Tier:     <low|medium|high> — <low: merge on green | medium: read "How to review"
          and the evidence | high: also the decisions and excerpts it names>

CI:       All checks green
Local:    <bug rounds and reviewer, Fable structure and regression counts>
PR:       <n> rounds: rounds 1-2 Neon + Claude, then <reviewer>; clean on <sha>
          Fixed: <count>  Disputed (with reasons): <count>
Review:   All CodeRabbit comments resolved or dismissed

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
