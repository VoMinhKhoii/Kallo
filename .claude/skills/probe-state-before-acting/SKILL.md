---
name: probe-state-before-acting
description: |
  Invoke before acting on state you have not just checked: creating a branch/worktree,
  staging, committing, stashing, pushing, rebasing, deleting code, resuming after a
  restart or compaction, saying what is on main or in prod, touching a remote database,
  coding against a library from memory, or any irreversible external step (TestFlight,
  prod deploy). Each probe takes seconds.
allowed-tools:
  - Bash
  - Read
  - Grep
metadata:
  author: distilled-from-kallo-sessions
  version: "0.2.0"
---

# Probe State Before Acting

Act on what IS, not what you remember. This failure class appeared in 9 of the last 14
recorded sessions; every instance was a skipped five-second check.

## 1. Where am I? — at task start and after EVERY restart, compaction or resume

```bash
pwd && git rev-parse --show-toplevel && git branch --show-current
```
A restart drops you in the main checkout, which is usually not your branch. One session
read or edited the wrong tree five times, each after a restart, and retracted a claim
made to the user: "was from the main branch, not this one" (`67ee41da` L3231→L3377).
Use absolute paths — relative `cd` failed five times in one session (`21d1773a`).

## 2. Before starting work on a branch

```bash
git fetch origin && git branch -a | grep <slug> && git log --oneline -5 origin/<branch>
git rev-list --count HEAD..origin/main          # how stale am I?
```
- The branch may already hold work (`ad88fbba` L282: 4 prototypes missed).
- **Branch from `origin/main`, never from HEAD** — `checkout -b` ran inside a checkout
  another live session had 13 commits ahead of main (`8a1d037c` L1129→L1650).
- Worktrees go in `.claude/worktrees/`, named `<type>/<slug>` — corrected by the user
  twice in one session (`67ee41da` L1165, L1201).

## 3. The checkout is shared — with the user and with other sessions

```bash
git worktree list && git status --short | head     # whose changes are these?
```
- **Never `git add -A` / `git add .`** — stage explicit paths. It swept 67 of the user's
  untracked files into a pushed commit (`f6072383` L961-969) and deleted
  `apps/docs/mobile/` unnoticed (`56cfd62e` L3942).
- **Never `git stash`, never `git reset` over someone else's staging.** The stash stack
  is shared across worktrees (`56cfd62e` L2327); stashing the user's WIP ended in a
  conflicted pop (`82d805ca` L1790); a reset cleared their staging (`586b1841` L1981).
  Dirty tree that isn't yours → count it, say so, use a worktree, re-verify it is
  untouched afterwards (`92b05d3b` L222, L391 — done right).
- No broad kills on a shared machine — `pkill -f next-server` takes down every
  session's dev server (`f6072383` L466).

## 4. Before pushing, and before any sentence about main or prod

```bash
git fetch && git log HEAD..origin/$(git branch --show-current) --oneline
```
"nothing… exists in production yet" was said from an unfetched `origin/main` and
retracted (`4d52b915` L444→L574). After opening a PR, check `mergeable` and its base: a
`CONFLICTING` PR runs **zero CI** (`82d805ca` L1612), and so does a stacked PR not based
on main (`4b54de9b` L1240). "No checks reported" ≠ "checks passed". CI variables:
`gh variable list --env production` first — environments shadow repo variables
(`67ee41da` L4004).

## 5. Before deleting code — map the blast radius

```bash
grep -rn "<symbol>" --include='*.ts*' .     # quote the glob; re-grep after deleting
```
An un-`head`ed, unfiltered search. A filtered one concluded "zero PostgREST access" and
the resulting REVOKE broke the OG route (`f6072383` L621→L1934).

## 6. Remote databases — resolve the target, and do not write

- **Which project is prod?** From `.github/workflows/cloud-run-prod.yml` or
  `list_projects` — never from memory. `apply_migration` was called against an id stale
  memory labelled prod; only the permission classifier stopped it (`346d3ece` L2662,
  L2750). Read the deploy workflow before explaining how migrations reach prod.
- **Never `apply_migration`, `supabase db push` or `migration repair`** — dev included
  (AGENTS.md §1). Migrations that lived only in the dev DB for five days had to be
  recovered by md5 and broke CI ordering (`5182cdc4` L4988→L5953→L6192).
- **New migration file:** `bun db:generate`, never hand-written; timestamp after
  `git ls-tree origin/main supabase/migrations | tail -1` and after open sibling PRs
  (four CI failures on record).
- MCP `execute_sql` returns only the LAST statement — one statement per probe
  (`f6072383` L804).

## 7. Before coding against a library or handing out instructions — read the artifact

`node_modules/<pkg>/dist/*.d.ts` and the package's bundled docs beat memory and beat a
web fetch of the wrong version (`92b05d3b` L82 vs L733). What a build shipped is what its
Fastfile / `--dart-define` injected, not what source suggests. Memory entries are leads,
not facts — and check them for a saved preference before choosing a tool or model
(`f3074584` L302 ignored at L2230).

## 8. Before irreversible external actions — walk the one-way doors

List the settings that only matter after the button is pressed and check them first
(TestFlight: export compliance, signing identity, build number). Never open a production
window to test a guess — two wrong guesses each cost a prod purchase-flag cycle
(`67ee41da` L4952, L5157).

---

**Status:** sections 2, 5, 7, 8 WEAKLY VALIDATED 2-0 (blind A/B, 2026-07-05, under the
0.1.0 wording — both wins were off-trap; `_evidence/validation/results.md`). Condensed
2026-09-20; sections 1, 3, 4, 6 are round-2, transcript-derived, NOT blind-validated.
Evidence: `_evidence/findings.md` §F6/§D4/§D5, `_evidence/findings-r2.md` §R2/§R3.
Drift re-check: `ls .github/workflows/cloud-run-prod.yml scripts/ci/check-migration-timestamps.js`
