---
name: root-cause-first
description: |
  Trigger discipline for bugs, failures, and anomalies: invoke on ANY unexpected
  behavior — a test failure, a broken feature, a retry, a "still broken" report, OR an
  anomaly during your own QA (a tap that doesn't land, output that looks off). Forbids
  a second patch on the same symptom until the mechanism of the failure is stated;
  forbids rationalizing away anomalies; requires checking memory/docs for known fixes
  before improvising. Complements superpowers:systematic-debugging (the full protocol —
  load it for any nontrivial bug); this skill encodes when to trigger it and the
  repo-specific failure patterns recorded in this project's session history.
allowed-tools:
  - Bash
  - Read
  - Grep
metadata:
  author: distilled-from-fable-5-sessions
  version: "0.1.0-candidate"
---

# Root Cause First

**The recorded failures this prevents:**
- A fix prescribed without checking the mechanism (Supabase Client-ID ordering, without
  reading how GoTrue consumes the field) **manufactured a production bug**, was then
  mis-diagnosed twice, and was solved only by finally reading the source: "ClientID[0]
  ... My earlier ordering advice was backwards" (`47ea3a99` L2010→L2094).
- An anomaly during self-QA (back-button taps failing 3×) was rationalized as bad aim
  ("Navigation back is fighting me") right up to the "Done" claim; the user then
  reported that exact bug, which was real and already diagnosable (`8a61a242`
  L2477/2492/2506→L2533).
- "fix with words" was patched twice over 12 days before anyone asked what it actually
  was — a full AI-pipeline re-run masquerading as an edit (`8c0bed51` L4250); it was
  then hidden, not fixed. Three similar re-fix chains in the same session.
- A known fix already in memory (iCloud→/tmp codesign) was bypassed for two failed
  workarounds (`f56af273` L148-172).

---

## Rule 1 — An anomaly during QA is a lead, not noise

If something behaves unexpectedly while YOU are testing — a tap that doesn't register,
a screen that doesn't update, output that looks slightly wrong — it is evidence about
the system until proven otherwise. You may not attribute it to tooling, aim, flakiness,
or the simulator without one direct check (read the code path / add a log / try the
programmatic equivalent). Never carry an unexplained anomaly across a "Done" claim.

## Rule 2 — No second patch on the same symptom without a stated mechanism

Before fix attempt #2 on anything, write one sentence in your output:
`Mechanism: <why attempt #1 failed / why the bug exists>` — grounded in something you
observed (log, source, probe), not something you assumed. The recorded contrast:
two blind relaunch patches vs the eventual real cause "`grep | head` is fragile under
`set -o pipefail` in a non-TTY" (`47ea3a99` L895→L910). If you cannot state the
mechanism, you are not fixing — you are guessing. Stop and diagnose (load
superpowers:systematic-debugging).

## Rule 3 — Check for a known fix before improvising

Before working around any infra/tooling failure, spend 30 seconds:
- memory files (`MEMORY.md` — this repo's history has entries for iCloud codesign→/tmp,
  Cloud Run URL aliases, l10n >50KiB test stalls, middleware auth-route exclusions),
- `AGENTS.md` §9 Gotchas,
- `apps/docs/mobile/` for Flutter build issues.
The `/tmp` fix was IN memory and even cited in-session before two workarounds were
attempted anyway (`f56af273` L112 vs L148-172).

## Rule 4 — Evidence before blame; prove external causes before pushing anything

When CI or prod fails: read the actual logs before touching the repo. The recorded
standard: "Following the systematic-debugging discipline — root cause from the actual
logs before any fix" → diagnosis that Docker Hub returned a 502, "Nothing to fix in the
repo" — and **no placebo commit was pushed** (`ad88fbba` L2459→L2494). Corollaries:
- Reproduce a failure (or its absence) more than once before believing it — three
  consistent timeouts, not one (`42e3116a` L83-84).
- Verify from the **shipped artifact**, not the source that generated it: the build's
  `--dart-define`/Fastfile values, the installed `node_modules/*.d.ts`, the deployed
  config (`42e3116a` L43-47; `ad88fbba` L469→479).

## Rule 5 — When the same feature needs its 3rd fix, question the design

A re-fix chain (same behavior touched ≥3×) means the model of the feature is wrong, not
the edges. Stop patching; state what the feature actually does end-to-end, compare with
what it should do, and check how established implementations solve it (AGENTS.md
mandates Context7 for exactly this — it was used 0 times in the 16-day session whose
feature had to be rebuilt, `8c0bed51` findings §F5).

## Rule 6 — Reports end with a falsification test

When you diagnose something you can't fully confirm from your seat, give the user a
concrete disconfirmation step WITH the alternative pre-registered: "turn off Wi-Fi and
try cellular... If it still fails, tell me — that would point back at a JWT signing-key
change" (`42e3116a` L119). And if the deliverable is a diagnosis, do not fix anything
unasked — that session ended with zero file edits.

---

**Status: VALIDATED 2-0 (blind A/B on Opus, 2026-07-05).** Clearest win: the control's
mechanism description of a prior failed fix contained two factual inaccuracies ("partially
assumed rather than carefully traced" — blind grader), while the skill arm reproduced
before touching anything. Second win was thin (both arms solved the singleton-cache
trap; rigor delta decided it). Details: `.claude/skills/_evidence/validation/results.md`.
Evidence: `.claude/skills/_evidence/findings.md` §F3 vs §D3/D4.
Last verified: 2026-07-04. Drift re-check: `find ~/.claude/projects -maxdepth 2 -name MEMORY.md | head -1 && grep -n 'Gotchas' AGENTS.md` (memory path varies per machine)
