# Review tiers

Every PR gets a tier from the paths it changes, never from who wrote it. The tier
sets how deep the agent review loop goes and what the owner reads before merging.
`node scripts/dev/risk-tier/risk-tier.mjs` prints the tier of the current branch;
`/ship` runs it and puts the result in the PR body and a `risk:<tier>` label.

The high-risk paths come from where fixes landed between 2026-07-15 and
2026-10-19: 38 of 79 fix PRs repaired a defect an earlier PR had shipped, and the
costly ones sat in auth and email (signups rolled back for 22 days), billing, the
meal pipeline, migrations and deploy settings.

| Tier | Paths | Agent review | Owner |
| --- | --- | --- | --- |
| **High** | the database (migrations, schema, client and pool); auth, session, redirects and email, including Supabase auth config and admin authorization; security infrastructure (rate limits, crypto); billing and entitlements (web pricing and checkout, webhooks, admin premium grants, the Flutter paywall and subscription screens); account export, deletion and privacy consent; CI, deploy and release (workflows, `scripts/ci`, `next.config`, release-please, iOS signing); the AI meal pipeline (`lib/ai/{pipeline,matching,portion,provider,prompts}`, `app/api/analyze-meal`) | Full `/ship` loop, plus evidence from a real run in the PR: the screen on a device or browser, the migration on a scratch database, the pipeline on real meals | Reads the "How to review" section and the diff of the high-risk files |
| **Medium** | Everything else | Full `/ship` loop | Reads the "How to review" section and the evidence, not the whole diff |
| **Low** | Only docs, agent skills/agents/commands, tests, eval and bench scripts | CI, the local Codex pass, at most two GitHub Codex rounds: findings from the first are fixed and re-reviewed once; fixes after the second are named in the summary as not re-reviewed. A P0 or P1 at any point makes it loop like medium | Merges on green |

A test file under a high-risk folder (`__tests__/`) does not make a change high.
The exact path rules are in `scripts/dev/risk-tier/risk-tier.mjs`. Change them
there, with a test, when a new area starts producing fixes.

## Fix-forward fast path

A fix PR runs at low depth when all of these hold:

- its "Regression of" field names a PR merged in the last 14 days;
- it only touches files that PR touched;
- its own tier is not high.

A fix to a high-risk path takes the full loop, however small.

## Regression of #

Every PR body has a "Regression of" field. A fix for something an earlier PR broke
names that PR; anything else says "none". The count of PRs naming a PR merged in
the previous 14 days is the guardrail for loosening review: if it rises, review got
too light. Reverts cannot serve as that guardrail, because breakage here is fixed
forward, not reverted.
