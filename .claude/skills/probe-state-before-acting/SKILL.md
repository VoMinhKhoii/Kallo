---
name: probe-state-before-acting
description: |
  Cheap state probes before any action whose correctness depends on external state:
  creating a worktree or branch, pushing, rebasing, deleting files/code, running
  verification gates, coding against a third-party library, or triggering irreversible
  external steps (TestFlight upload, prod deploy). Every recorded incident in this
  repo's session history from this class was a skipped 5-second check: a worktree cut
  from main that missed the remote branch's existing work, gates run in the wrong repo
  root (invalidating a whole verification pass), and an App Store upload that hit the
  export-compliance wall on the user's device.
allowed-tools:
  - Bash
  - Read
  - Grep
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Probe State Before Acting

Act on what IS, not on what you remember or assume. Each probe below costs seconds;
each recorded skip cost a user round-trip or a redone verification pass.

---

## 1. Before creating a worktree / starting on "a branch"

```bash
git fetch origin
git branch -a | grep <slug>          # does the branch already exist remotely?
git log --oneline -5 origin/<branch> # what's already on it?
```
Recorded miss: a worktree was created fresh-from-main for a named remote branch that
already held 4 prototypes; the user had to point it out ("in this
claude/landing-page-redesign-pn19ea already have some tho?" — `ad88fbba` L282, admission
L289: "my fresh-from-main worktree missed it").
Also: name the branch explicitly at creation (`<type>/<slug>` per AGENTS.md) — the
auto-`worktree-*` name had to be renamed at ship time in two recorded sessions.

## 2. Before running gates or claiming anything about "the repo"

```bash
git rev-parse --show-toplevel && git branch --show-current
```
Recorded miss: an entire verification pass ran in the main checkout instead of the
worktree — "that invalidates the earlier analyze" (`932ee514` L872, after wrong-root
lint at L833). One line prevents the whole class.

## 3. Before pushing / after rebasing

```bash
git fetch && git log HEAD..origin/$(git branch --show-current) --oneline  # remote moved?
```
Recorded save: this exact probe caught an independently-merged fix mid-session, before
push (`ad88fbba` L2379); after the ensuing rebase, state was re-verified ("quick sanity:
cleanup state survived the rebase", L2408) and the conflict was resolved by keeping
main's version — zero churn on freshly-merged code.

## 4. Before deleting code or files — map the blast radius

```bash
grep -rn "<module-or-symbol>" --include='*.ts*' .   # who imports/uses this?
```
then after the deletion, grep again for surviving consumers, and re-run the surviving
surface live. Recorded standard: "Mapping the blast radius first so I don't cut a
shared dependency" → shared leaf extracted before `git rm` → post-delete consumer grep
→ fresh build + live re-verify (`ad88fbba` L2279-2364).

## 5. Before coding against a third-party API — read the shipped artifact

```bash
ls node_modules/<pkg>/dist/*.d.ts    # then read the actual signatures
```
Never code against a remembered API. Recorded standard: r3f-globe's `.d.ts` read before
the first line of globe code — "All API details verified (`r3f-globe@1.6.0`, default
export, `polygonsTransitionDuration`...)" (`ad88fbba` L469→479). Same principle for
builds: what a binary shipped with is what its Fastfile/`--dart-define` injected, not
what the source suggests (`42e3116a` L43-47). For patterns/best practices, AGENTS.md
already mandates Context7 — this skill covers the exact-signature check.

## 6. Before irreversible external actions — walk the one-way doors

Before a TestFlight upload, store submission, prod deploy, or any action you cannot
undo: list the settings that only matter after the button is pressed, and check them
first. Recorded miss: `ITSAppUsesNonExemptEncryption` was checked only after the
upload; the user hit Apple's France export-compliance questionnaire on-device
(`f56af273` L663→L674). For TestFlight specifically: export compliance flag, signing
identity, version/build number, and the release notes field.

---

**Status: WEAKLY VALIDATED 2-0 (blind A/B on Opus, 2026-07-05) — read the caveat.**
Both wins were OFF-TRAP: the control arms also found the hidden branch and the
string-path consumers, so the planted traps never differentiated; the blind verdicts
rode on general implementation rigor instead. The skill measurably did not hurt and
correlated with marginally better checks, but its core probes were not demonstrated to
be load-bearing in this experiment. Transcript evidence remains the primary
justification. Details: `.claude/skills/_evidence/validation/results.md`.
Evidence: `.claude/skills/_evidence/findings.md` §F6 vs §D4/D5.
Last verified: 2026-07-04. Drift re-check: `grep -n 'Branch Naming' AGENTS.md && ls apps/mobile-flutter/ios/fastlane/Fastfile`
