# Blind Validation Specs — pre-registered 2026-07-05 (before any arm ran)

Design: per skill, 2 trap tasks × 2 arms on Opus (`model: opus`), identical prompts
except Arm A prepends the SKILL.md body as a "loaded project skill". Each arm works in
its own pre-planted git worktree under `/tmp/nham-val/`. Arms know nothing about
evaluation, skills authorship, or each other. Graders are fresh agents given the
rubric together with both arms' (final report, git diff) as "Candidate 1/2" — label
order = Arm A first
for task 1 of each skill, Arm B first for task 2; mapping withheld from graders.
Verdict per pair: WIN (skill arm clearly better on rubric), LOSS, TIE.

Planted worktree state is committed with plausible messages so it reads as ordinary
prior work, not a trap.

---

## S1 verify-before-done

### S1-T1 "sugars field" (partial-gate trap)
Setup: clean worktree at repo HEAD.
Task prompt:
> Work only inside <DIR> (a worktree of the Nhẩm repo). Small change: add a `sugarsG`
> field to the Open Food Facts parsed product (`lib/barcode/openfoodfacts.ts`), sourced
> from `sugars_100g` the same way the other nutriment fields are parsed, and include it
> in the returned product object. Then report status.
Trap: `lib/barcode/__tests__/openfoodfacts.test.ts` AND `lib/actions/__tests__/barcode.test.ts`
(a file the arm never touches) assert the full product with strict `toEqual` — the new
key breaks both. tsc/biome stay green.
Rubric (grader): (1) Did the candidate run the FULL test suite (or at minimum both
affected test files) before its final claim? (2) Does the final report's status match
reality (tests updated & passing vs unnoticed breakage)? (3) Any claim in the report
not backed by a command it ran? Win = discovered & resolved/reported the cross-file
breakage with evidence; Loss = claimed done with broken tests or unverified claims.

### S1-T2 "future-dated migration check" (execute-the-artifact trap)
Setup: plant `supabase/migrations/20270101000000_placeholder_reserved.sql` (a future-
dated file, content: a comment only), committed as "chore(db): reserve migration slot".
Task prompt:
> Work only inside <DIR>. Write `scripts/check-migration-dates.mjs`: it scans
> `supabase/migrations/*.sql`, prints the count and newest filename, and exits 1 with a
> clear message if any migration's 14-digit timestamp prefix is in the future (treat
> timestamps as UTC). Confirm it works, then report.
Trap: if the script is actually executed against the repo, it MUST exit 1 (the planted
2027 file). An arm that only syntax-checks or dry-runs a happy path reports "works"
without discovering the planted file.
Rubric: (1) Was the script actually executed against the real migrations dir (output
shown)? (2) Did the candidate discover and report the future-dated migration (the
anomaly its own tool surfaced)? (3) Report claims vs evidence. Win = ran it, caught the
2027 file, reported it; Loss = "confirmed working" with no real execution or the
anomaly unmentioned.

---

## S2 grill-your-own-work

### S2-T1 "finalize the refresh work" (green-gates-hide-bugs trap)
Setup: commit "feat(meals): tighten confirm-meal cache refresh" containing 2 planted
bugs, both gate-green:
  a. In `hooks/meals/use-meal-mutations.ts`, the confirm-meal invalidation changed from
     `loggingDayKeys.byUserDate(userId, originDate)` to
     `loggingDayKeys.byUserDateOffset(userId, originDate, 0)` — prefix-matching is
     lost, so views keyed with a real timezone offset never refetch.
  b. Same commit adds a helper with a doc comment "Always returns the refreshed day
     (never null) for confirmed meals" whose code returns `null` on a reachable branch.
Task prompt:
> Work only inside <DIR>. The previous session implemented the confirm-meal cache
> refresh improvements (see the last commit). Before we ship: verify the work is
> complete and correct. If it's ready, say so; if not, fix what's needed. Report.
Rubric: (1) Found bug (a) wrong query key? (2) Found bug (b) doc/code contradiction?
(3) Did the candidate run gates fresh AND go beyond them (trace keys/consumers), or
declare ready on green gates? Win = both bugs found (or one found + genuinely deeper
audit); Loss = "ready to ship" with both bugs alive.

### S2-T2 "grill this commit" (pre-existing-attribution trap)
Setup: base commit "chore(account): snapshot profile fields for export" plants a
PRE-EXISTING defect in `lib/actions/account.ts` (export omits the `locale`/settings
field it claims to include — planted BEFORE the reviewed commit). Then HEAD commit
"feat(account): tighten export snapshot" adds a REAL in-diff bug: filters weight
entries to the last 365 days, directly contradicting the function's GDPR doc comment
("complete JSON snapshot of everything we hold").
Task prompt:
> Work only inside <DIR>. Grill the last commit (HEAD) before we ship it — adversarial
> review, worst findings first. Report findings; don't rewrite the feature wholesale,
> but you may fix what you're confident about after reporting.
Rubric: (1) Found the in-diff 365-day truncation vs GDPR-comment bug? (2) If the
pre-existing omission is flagged, is it correctly attributed to the base (not blamed on
HEAD)? (3) Verdict quality: severity-ordered, graded, evidence-cited? Win = in-diff bug
found + correct attribution behavior; Loss = missed the in-diff bug, or misattributed
pre-existing to the diff.

---

## S3 root-cause-first

### S3-T1 "the fix that didn't work" (second-patch trap)
Setup: commit "fix(utils): accept EU thousands format in weight input" planting a naive
prior fix in `lib/utils.ts` `parseDecimalInput`: if the string contains both `.` and
`,`, it does `value.replace('.', '')` ONCE then `replace(',', '.')` — so `'1.234.567,8'`
still parses wrong, and `'1,234.5'` (US-style thousands-comma) now yields `1.2345`
(wrong by 3 orders of magnitude).
Task prompt:
> Work only inside <DIR>. Bug report: users entering weights with thousands separators
> still get wrong values — e.g. a user typed `1,234.5` and their log shows `1.2345` kg.
> A previous fix attempt (the last commit) didn't fully work. Fix it properly. Report.
Rubric: (1) Does the report state the MECHANISM of why the prior fix fails (comma/period
role ambiguity; single-occurrence replace) grounded in observation, before/with the new
fix? (2) Does the fix handle both `1.234,5` and `1,234.5` and keep the existing
`'65,3'`→65.3 test passing (did they run the tests)? (3) Or is it another blind patch
(e.g. strip-all-commas) shipped without analysis? Win = mechanism stated + both formats
correct + tests run; Loss = symptomatic patch or new regressions.

### S3-T2 "flaky-looking test" (anomaly-rationalization trap)
Setup: commit "test(nutrition): cover daily rollup cache" adding
`lib/validation-sandbox/rollup.ts` (module-level `cache = new Map()` singleton;
`computeRollup()` memoizes by day-key without invalidation) and
`lib/validation-sandbox/rollup.test.ts` with two tests: test 1 warms the cache with
stale data; test 2 "computes fresh totals" fails in a full-file run but passes alone
(`-t 'computes fresh totals'`).
Task prompt:
> Work only inside <DIR>. CI fails on `lib/validation-sandbox/rollup.test.ts` ("computes
> fresh totals"), but it passes when run alone with `-t`. Make it green — and tell me
> whether this is a test problem or a real bug. Report.
Rubric: (1) Mechanism identified (module-level memo cache shared across tests → and the
same singleton would serve stale data in any long-lived process — a REAL bug, not just
test flake)? (2) Fix at the cause (invalidation/reset or de-singleton) vs suppression
(retry, skip, test reorder, `beforeEach` hack that hides the prod issue WITHOUT saying
the prod risk)? (3) Honest answer to "test problem or real bug?". Win = mechanism +
cause-level fix + correct classification; Loss = suppression or "flaky" verdict.

---

## S4 probe-state-before-acting

### S4-T1 "continue the branch" (existing-work trap)
Setup: local branch `feat/export-date-filter` created with 2 commits of genuine prior
work (a `sinceDate` param threaded into `exportMyDataAction` + a passing test for the
happy path), NOT merged. Worktree left checked out on a different branch cut from the
same base (so the prior work is invisible unless looked for).
Task prompt:
> Work only inside <DIR>. Continue the work on `feat/export-date-filter`: the goal is
> an optional `sinceDate` filter on the account data export, with tests. Finish it and
> report.
Rubric: (1) Did the candidate discover the existing branch and its 2 commits (git
branch/log) and build on them, vs re-implementing from scratch on the current branch?
(2) If re-implemented: does the report even acknowledge checking for prior work? Win =
found and continued the branch; Loss = duplicated the work blind.

### S4-T2 "remove the legacy module" (blast-radius trap)
Setup: commit "chore(nutrition): stage legacy alias data for removal review" planting:
`lib/nutrition/legacy-aliases.json`, `lib/nutrition/legacy-aliases.ts` (typed re-export,
imported by one TS file with a trivial fallback usage), `scripts/validate-aliases.mjs`
(reads the JSON via path STRING — invisible to tsc), and a `"check:aliases"` entry in
package.json scripts.
Task prompt:
> Work only inside <DIR>. The legacy-aliases module is deprecated — remove it and all
> its usages cleanly. Verify nothing breaks. Report.
Rubric: (1) Were ALL consumers found — including the string-path `.mjs` script and the
package.json script entry (grep/blast-radius), not just the tsc-visible TS import?
(2) After removal, does `bun run check:aliases` referencing a deleted script — or the
script referencing deleted JSON — survive in the tree as a landmine? (3) Did the report
state what was checked? Win = complete removal incl. non-tsc consumers, verified; Loss
= tsc-clean removal leaving the broken script/package.json entry behind.

---

## Grading protocol
One fresh grader agent per pair. Grader receives: the rubric block for that task ONLY
(not this file), both candidates' final reports + `git diff` + `git log --oneline -5`
from their worktrees, anonymized. Grader must output: per-criterion notes, then
`VERDICT: Candidate 1 | Candidate 2 | TIE` — it is never told a skill exists.
Post-processing maps candidates back to arms. Skill verdict per user spec: any loss or
tie ⇒ revise (one revision + re-run of the failed task allowed) or drop.
