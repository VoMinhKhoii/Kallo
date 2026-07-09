---
name: verify-before-done
description: |
  Verification discipline before ANY claim of done/fixed/complete/working — and before
  /ship, committing, pushing, or telling the user to "test it now". Invoke whenever you
  are about to report success, finish a feature, close a bug, or hand work back to the
  user. Green unit gates are NOT proof the product works: this skill forces verification
  at two altitudes (full repo gates + observed behavior) and an evidence-audited final
  report. Derived from recorded Opus sessions in this repo where every major
  user-visible failure shipped behind green gates.
allowed-tools:
  - Bash
  - Read
  - Skill
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Verify Before Done

**The recorded failure this prevents:** in this repo's session history, unit gates were
run faithfully and still concealed every major failure — "The Circle port is complete
and verified... All gates green" hid 9 logic bugs, 4 missing parity features, and an
unported widget (session `932ee514` L945 vs L1052); 16 days of UI work shipped with
zero visual checks and ended in a 3-surface revert (session `8c0bed51`); a "Done" PR
failed CI minutes later because "vitest passed" meant one test file (session `8013b7ec`
L183→L189).

---

## Rule 1 — Two altitudes, both mandatory

A done-claim requires BOTH:

1. **Gate altitude** — the repo's real gates, full breadth (Rule 2).
2. **Behavior altitude** — you observed the change working (Rule 3).

Gates prove the code compiles and old tests pass. They do not prove the feature works,
matches the mandate, or looks right. Treat "all gates green" as the *entry ticket* to
verification, not the conclusion.

## Rule 2 — Full gates, not partial gates, from the right directory

Run the same commands CI runs, repo-wide:

```bash
# web (from repo/worktree root — confirm with: git rev-parse --show-toplevel)
bunx tsc --noEmit
biome ci .                      # NOT a scoped `biome check <files>` — the scoped form
                                # missed an import-sort error CI then caught (80a56ca1 L2382)
bun vitest run                  # the FULL suite — a single-file run shipped a "Done" PR
                                # that CI failed minutes later (8013b7ec L175→L189)

# mobile (apps/mobile-flutter)
flutter analyze
flutter test
```

- Confirm you are in the **worktree**, not the main checkout — a full verification pass
  was once invalidated by running in the wrong root, twice (`932ee514` L833, L872).
- **Never push before the full-suite result returns.** A push that preceded its gate
  result was punished by a (flaky, but unknown-at-push-time) failure (`8c0bed51` L6308).

## Rule 3 — Behavior verification, by change type

| You changed | Minimum observation before claiming done |
|---|---|
| Web UI | Render it live (browse/playwright): screenshot **and** at least one programmatic assertion (element positions, visibility, event fires). Look at the screenshot yourself. |
| Mobile UI | Simulator screenshot of the changed screen(s), post-change. If the fix targets a layout state (keyboard up, short screen, centered sheet), capture **that state** — a centering fix once shipped without ever being seen and was wrong (`80a56ca1` L2141→L2171). |
| Animation / interaction | Capture the hardest frame, not the rest state: mid-transition, hover active, both ends of a toggle (`ad88fbba` L1290, L1813 — the discipline that kept corrective steering at zero for functionality). |
| Server action / API contract | Execute one real consumer path (curl the route, run the screen that calls it). "tsc clean; the test mocks the loader, so runtime is fine" preceded an unrendered dashboard refactor (`80a56ca1` L1907). |
| Script / tooling | Execute its **primary path** once. `bash -n` + committing "Script works" shipped a dev script whose main path had never run (`f56af273` L740). |
| CI workflow file | Trigger it, or state plainly in your report: "this workflow has not been executed" (`47ea3a99` L1685 claimed shipped-and-green for a workflow that never ran). |

## Rule 4 — Verify the preconditions of instructions you give the user

Before writing "test it now": confirm the backend/dev server is actually up, and that
the flow you describe can occur on the user's platform. "Test it now... expect the
native account sheet" was issued with the backend known-down and a sheet that cannot
appear on the iOS simulator — the user hit both walls (`47ea3a99` L962→L967, L1027).

## Rule 5 — The evidence-audited report

Before sending the final message, audit each claim in it against a tool result from
THIS session. Claims with no backing tool result get rewritten as "not verified: <why>".
(Anthropic reports this practice "nearly eliminated fabricated status reports" —
official Fable 5 prompting guide; it matches the transcript evidence exactly.)

Format the wrap-up as: what changed → what was verified and HOW (command/screenshot per
claim) → what was NOT verified and why. An explicitly-unverified item is acceptable; an
implicitly-unverified claim is the failure mode.

## Rule 6 — The discipline holds under context pressure

The recorded collapse pattern: verification was strong all session, then at ~84%
context the last four changes shipped on static gates alone (`80a56ca1`). If you notice
compaction approaching or you are tempted to write "the code is complete and I don't
want to run out mid-screenshot" (`80a56ca1` L2171 — verbatim, preceding an unverified
ship): verify FIRST, then summarize. If genuinely impossible, the report must say
"shipped unverified due to session limits" in those words.

---

**Status: VALIDATED 2-0 (blind A/B on Opus, 2026-07-05).** Strongest result of the four
skills: in the cross-file-test trap the control arm claimed "Complete" over a test
suite it never ran (exactly the recorded `8013b7ec` failure), while the skill arm ran
the full 1,473-test suite and its report matched measured reality claim-for-claim. The
second win was thin (both arms verified; the skill arm's evidence-anchored report won).
Details: `.claude/skills/_evidence/validation/results.md`.
Evidence: `.claude/skills/_evidence/findings.md` §F1/F2/F4 vs §D1.
Last verified: 2026-07-04. Drift re-check: `grep -n 'biome ci\|tsc --noEmit\|vitest run\|flutter' .github/workflows/*.yml`
