<!--
Title format: use Conventional Commits, e.g.
  feat(ai): add Vietnamese herb recognition
  fix(logging): correct DM Sans line height
  docs: update README quickstart
This drives the changelog automatically via release-please.
-->

## Summary

<!-- One or two sentences on what this PR does and why. -->

## Changes

-
-

## How to review

<!--
Medium and high tier (docs/REVIEW_TIERS.md). The owner reads this instead of the
whole diff, so make it enough to decide on:
- what behaves differently for a user, in one or two sentences;
- the 2-3 places the risk sits, as file:line, and what could go wrong there;
- what the evidence below covers, and what it cannot see.
High tier also names the decisions only the owner can make and the few diff
excerpts (file:line ranges) worth reading.
Low tier: write "Low tier, merge on green."
-->

## Evidence

<!--
What was run and what it showed, each claim pointing at output: gates, tests,
the screen on a device or browser (screenshots, docs/REAL_RUN_EVIDENCE.md), the
eval result, the migration on a scratch database. Say what did not run as
plainly as what did; high tier names what was not exercised in a real
environment.
-->

## Risk tier

<!-- low / medium / high and its reasons, from `node scripts/dev/risk-tier/risk-tier.mjs`. A fix-forward PR reviewed as low says both: "medium by path, reviewed as low: fix-forward of #N". -->

## Regression of

<!-- The PR whose defect this fixes (#123), or "none". -->

## How to revert

<!-- Revert the PR, or the flag / kill switch that turns it off. Name any migration or data change a revert does not undo. -->

## Checklist

- [ ] Conventional Commit title (feat / fix / perf / refactor / docs / chore / ci / test)
- [ ] Local lint, typecheck, and tests pass
- [ ] Behavior changes are documented in the PR description
- [ ] No secrets or `.env*` files are committed
