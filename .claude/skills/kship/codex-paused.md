# Codex Review Procedure (Paused)

> **Not used for now.** Keep this file for when Codex review is re-enabled.
> While paused, `/kship` uses cross-model **Claude Opus 5.5** and **Gemini 4 Neon**
> (see `SKILL.md`) and never invokes `codex review` or `@codex review`.

---

## Local Review: Codex Sol & Astra (Phase 3b)

```bash
# The prompt names the diff range: `codex review` rejects --base together
# with custom instructions.
cat .claude/skills/kship/local-review.md <scratchpad>/review-brief.md \
  <scratchpad>/pass-<name>.md \
  | codex review -c 'model="<model>"' -c 'sandbox_mode="read-only"' - \
  > <scratchpad>/local-review-<name>.md 2>&1
```

`<model>` was `gpt-6.1-sol` for fallback and `gpt-6-astra` for the step-back pass.

---

## GitHub PR Review: `@codex review` (Phase 6c)

Codex is the `chatgpt-codex-connector[bot]` GitHub app. It reviews on demand when
the PR gets a comment starting with `@codex review`; drafts are fine.

### Request a review

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

### Wait for the verdict

Codex reacts 👀 while it runs (usually 2-10 minutes) and keeps a
`## Codex Review Summary` status table comment up to date. That table is status,
not a verdict. **Do not push while a round is running**: the verdict is tied to
the commit the round was requested on, and a push mid-round leaves it judging a
head that no longer exists. Never use foreground `sleep`; run a background poll or
a Monitor until a verdict on the current head appears. The verdict is one of:

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
20 minutes, re-post the `@codex review` comment once; if it is silent again, treat
it as out of usage (below).

### Codex out of usage

The bot answers a request with `You have reached your Codex usage limits for code
reviews` (its status table shows ❌ Failed). That is not a review and not a reason
to stop reviewing: from here on **Neon is the PR reviewer** for this `/kship`.

1. Do not re-request Codex every round. Each round is a Neon pass on the current
   head (as above, posted on the PR), its findings judged, fixed, pushed, CI green.
2. Loop until a Neon pass on the **current** head reports no finding we fix (a
   finding we rejected with evidence does not block). The "From round 3 on" rules
   below apply to these rounds too.
3. If Neon cannot run on the current head (Phase 3b's rules exhausted), post that
   on the PR, stop the loop, and hand the PR to the user: no reviewer has seen
   this head, and a pass that did not run is never a clean pass.
4. Once Neon is clean, and only if `HEAD` has moved past the commit Codex hit its
   limit on, request `@codex review` once more on that head (limits reset).
   Approved → done. Findings → Codex is back: leave out-of-usage mode, handle them
   as usual, and run the normal loop until Codex approves or hits its limit again.
   Usage limit again, or silence after one 20-minute wait → stop asking; the Neon
   approval stands.
5. Evidence and the Phase 7 summary say: "Codex: out of usage on <sha>; Neon
   reviewed <n> rounds, clean on <sha>."
