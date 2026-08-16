# Contrastive Grill Report — Opus Failures vs Fable Disciplines

Generated 2026-07-04. Method: 6 grill agents over Opus-dominant transcripts, 3 mining
agents over Fable-5 material, 1 web sweep. Every transcript claim below carries
`(session, JSONL line)`; 13 randomly sampled citations were re-verified verbatim against
the raw files before this report was written. Git-only inferences and external (web)
evidence are labeled as such — they are weaker tiers. Sessions referenced by 8-char
prefix; full paths in [sessions.md](sessions.md).

**Corpus honesty:** Fable evidence ≈ 1 large session (`ad88fbba`, ~708 unique msgs),
half of `932ee514`, three small closer-segments, one pure incident-response session
(`42e3116a`), and Fable segments inside `8c0bed51`. Opus evidence is 4-6× larger. Where
a "delta" rests on a single episode, that is stated.

---

## 1. Pain scoreboard (user metric: steering + can't-merge-in-one-go)

Corrective steers = human messages fixing the assistant's mistake (classified per
message by the grill agents; directive/creative steers excluded).

| Session | Model | Corrective / total steers | One-go merge? |
|---|---|---|---|
| `47ea3a99` google sign-in | Opus | **9 / 41** | PR #163 merged, but prod Apple-linking bug was caused + mis-diagnosed in-session |
| `8c0bed51` meal-card 16-day | Opus (+Fable seg.) | **12 / ~54** | No — 3-surface revert (06-15), hardening pass (06-24), 4 re-fix chains |
| `80a56ca1` weight chart | Opus | **8 / 23** | PR #171 merged; single-source refactor only after user invoked thermo review |
| `8013b7ec` barcode | Opus | 4 / 8 (+1 CI-fail webhook) | No — CI failed post-"Done"; 3 same-day post-merge fixes |
| `f56af273` Flutter TestFlight | Opus | 2 / 13 | — (pipeline session) |
| `ca3ab2c1` auth gateway | Opus | 1 / 11 | PR #183 one-go; review subagent caught a launch-blocker pre-merge |
| `97979119` share-default | Opus | ~0.5 / 2 | **Yes — model session (control)** |
| `932ee514` circle port | Opus→Fable | **0 in-flight / 8** | PR #180 one-go — but only after the Fable grill fixed 9 bugs Opus left behind green gates |
| `ad88fbba` landing globe | Fable (+Opus seg.) | ~2.5 / 17 unique (taste only) | PR #181 one-go; post-merge CI fail proven external (Docker Hub) |
| `42e3116a` outage | Fable | 0 / 2 | n/a — root cause in ~11 min, zero edits |

Pattern: Opus corrective share ~20-35% in feature sessions; Fable's hard correctives on
record are aesthetic-taste misses, not broken/falsely-claimed functionality
(`ad88fbba` L1451, L1613). Sample is small on the Fable side — stated, not oversold.

---

## 2. Opus failure patterns (transcript-cited)

### F1. Verification at the wrong altitude — the #1 pattern by cost
Unit gates (tsc/biome/vitest/analyze) are run faithfully — and treated as proof the
*product* works. Every major user-visible failure on record shipped behind green gates:
- `8c0bed51`: **0 browser/screenshot calls in 1,052 tool lines across 16 days of UI
  work** (~61 commits). User personally discovered the nav/timeline/dashboard were wrong
  → 3-surface revert (L3103/3121); discovered meal-card actions were shallow 12 days
  later (L4150).
- `932ee514`: Opus's "The Circle port is complete and verified... All gates green"
  (L945) concealed 9 file:line-cited logic bugs, 4 skipped parity features, and an
  entirely unported widget + never-written mutation (L1052, L1371) under an explicit
  full-parity mandate.
- `8013b7ec`: three consecutive barcode-dialog UI rounds shipped with zero visual/runtime
  verification; every defect (garbage kcal, grams-for-beverage, fonts, padding) was
  found by the human (L473, L536) despite browse/playwright being available.
- `80a56ca1`: discipline existed then **collapsed under context pressure** (~84%): the
  sheet-centering fix, haptics, pill server-field switch, and a CodeRabbit layout rewrap
  all shipped on `flutter analyze` alone; the centering fix was never seen rendered
  (L2141→L2171→no screenshot after L2132). Zero test executions in 925 messages.
- `47ea3a99`: TestFlight workflow "shipped... all checks green" (L1685) — the workflow
  itself was never executed once (yamllint + `ruby -c` only).

### F2. Done-claims with untested preconditions
- `47ea3a99` L962: "Test it now (on the simulator)... Expect the **native account
  sheet**" — with the backend known-down since L956 and a UX that cannot occur on the
  iOS simulator (admitted L1030). User hit both walls (L967, L1027).
- `f56af273` L740/748: `run_dev.sh` committed + documented with its primary
  sync→simulator→run path never executed (`bash -n` only).

### F3. Root cause bypassed / anomaly rationalized away
- `47ea3a99` L2010→2094: prescribed Supabase Client-ID ordering without checking how
  GoTrue consumes the field → **manufactured the prod "Sign up not complete" bug** →
  mis-diagnosed twice (L2052, L2065, refuted by user L2068) → fixed only after reading
  GoTrue source: "ClientID[0] ... My earlier ordering advice was backwards" (L2094).
- `8a61a242` L2477/2492/2506: own QA taps on Settings back button failed 3× — blamed
  aim ("Navigation back is fighting me") → declared Done (L2529) → user reported that
  exact bug (L2533) → real pre-existing `go`-vs-`push` regression, diagnosable from
  evidence already in hand (L2545, L2572).
- `8c0bed51`: "fix with words" shipped 06-12, patched twice, root cause named only
  06-24 after two user pushes past Opus's own "genuinely well-built" clearance (L4213):
  "refine isn't an edit at all. It re-runs the entire AI pipeline... and throws away the
  original meal" (L4250) → feature hidden behind a flag (L4848). Three more re-fix
  chains documented (log-again 2×, edit-meal 3×, nav visuals ship→revert→polish).
- `f56af273` L148-172: iCloud codesign failure worked around twice (xattr strip,
  COPYFILE_DISABLE) although the `/tmp` fix was already in memory and cited at L112.
- `47ea3a99` L895→910: background launch patched on an assumed cause; `setsid` no-op'd
  on macOS; real cause (`grep|head` under `pipefail`) found on attempt three.

### F4. Partial gates passed off as full gates
- `8013b7ec` L175/183: "typecheck, biome, vitest — passed locally" = **one** test file +
  biome on touched files only → CI Unit Test failed minutes later (L189, admission
  L197). Full local suite never run even after the burn.
- `80a56ca1` L2382: scoped `bunx biome check` all session vs CI's `biome ci .` → import-
  sort error reached CI (a memorized project gotcha).
- `8c0bed51` L6308: pushed before the full-suite run reported; it then reported a
  failure (L6318) — later proven flaky, but the push preceded the evidence.

### F5. Preflight conventions skipped (AGENTS.md §2.2 / Context7) — repeat offense
- Context7: **0 uses in the entire 16-day `8c0bed51`** despite the user literally asking
  for "best practice of similar people who already do those kind of stuff" (L4150); 0 in
  `80a56ca1`, `ca3ab2c1` (late deprecated-API discovery L666), `8a61a242`.
- Skill preflight skipped at coding-start in `80a56ca1` (one `browse` call all session),
  `ca3ab2c1` (Zod mandate initially violated, fixed at review cost L908), `8013b7ec`
  (kallo-design invoked only after the user complained), `97979119` (mitigated).
- `8013b7ec`: `npx` in a bun repo (later self-corrected); hand-written schema migration
  outside the drizzle-kit workflow rationalized by a mismatched precedent (L146).

### F6. Unchecked state assumptions
- `ad88fbba` Opus segment L282/289: worktree created fresh-from-main without checking
  the remote branch it was named after — missed 4 existing prototypes; user caught it.
- `932ee514` L833/L872: verification run in the wrong repo root twice (self-caught:
  "that invalidates the earlier analyze"), plus cwd drift at L176 — three hits of one
  class.
- `f56af273` L663/674: export compliance checked only **after** the irreversible
  TestFlight upload; user hit Apple's France questionnaire on-device.

### F7. Scope creep & self-narration — genuinely rare
Scope creep: review subagents dispatched **with edit access** during a review mandate
auto-applied changes and broke `flutter analyze` (`47ea3a99` L339/349); labels-inside-
plot overshoot (`80a56ca1` L1711, admitted). Otherwise none found across five grills.
Self-narration unbacked by tools: none found anywhere — narration exists ("I have the
full picture", `8013b7ec` L66) but tool calls consistently back diligence claims. These
two categories are NOT the problem this corpus shows.

### Git-only inference (no transcript — weaker tier)
Log-weight bottom-sheet geometry patched piecewise across 4 commits / 3 PRs / ~7h by
simulator-less cloud sessions; the user's phone was the only verifier between PRs
(commits `a0ca934`→`e5b84dc`→`42a57c7`→`b0caf57`; see sessions.md errata #2).

---

## 3. Fable counter-disciplines (transcript-cited)

### D1. Verify at behavior altitude, not gate altitude
`ad88fbba`: 38 programmatic browser probes + 14 screenshots against 105 edits — DOM
assertions ("all 22 annotations across every stop now sit inside the viewport" L1542;
hover-probe sweep until "FOUND at center±20,0" L795), mobile resize checks (L953),
**reads its own screenshots** (~8×) and deliberately captures the hardest frame:
mid-morph crossfade (L1290), same page at two solar states (L1813). `932ee514` Fable
segment: gates re-run per-phase (7× flutter test, full web suite twice L1608/L1937),
not once at the end. `8c0bed51` Fable segment: independent gate checks *first*, plus a
hand-written en/vi locale-parity script (L2874-75).

### D2. The "grill" closer — adversarial review of one's own/peer work
The user manually reaches for this: `/model` → Fable + "grill this work from opus"
(`83d4b9bf` L880; `bf4eb0ac` L899, verbatim twice on Jul-04; "Now its your turn to
audit, critique... Opus work" `8c0bed51` L2871; "Grill it... flaws that Opus may have
missed" `932ee514` L955). The recurring protocol:
1. Independent gates first, before reading the diff (`8c0bed51` L2874).
2. Suspicion-driven targeted probes ("a few targeted checks on points I'm suspicious
   about" `bf4eb0ac` L902 — landing the wrong-query-key bug L934).
3. Check whether a defect **pre-exists on the base** before blaming the diff
   (`git show main:...` `8c0bed51` L2886).
4. Reviewer subagents mandated **REPORT ONLY, DO NOT EDIT** (`8c0bed51` L2912-18) —
   the exact inverse of the `47ea3a99` L339 edit-access accident.
5. Self-verify the headline finding before reporting it ("Quick self-check on the
   alleged mobile blocker... The grill caught a genuine functional bug" `83d4b9bf` L932).
6. Verdicts graded and severity-ordered, with honest negatives ("Non-issues verified
   (no action)" `932ee514` L1052; "yes-with-fixes — not yet at your bar" `8c0bed51`
   L2986; "worst first" `bf4eb0ac` L934).
7. Re-verify fix-agents' claims independently before pushing (grep for survivors,
   `8c0bed51` L3013).
Result on record: the `932ee514` grill turned Opus's green-gated port into a one-go
merge by finding/fixing 9 logic bugs + 4 parity gaps pre-PR.

### D3. Debugging: mechanism before fix, evidence before belief
`42e3116a` (pure Fable, outage → root cause in ~11 min, **zero file edits**): hypothesis
stated up front (L24) → systematic-debugging protocol loaded as the first act (L25) →
verify the **shipped artifact's** config, not the source (`--dart-define` chase, L43-47)
→ parallel live probes bisect the stack (L50-53) → reproduce 3× before believing (L83-84)
→ each alternative killed by a dedicated probe (status API read critically L119, DoH
cross-check L88, `--resolve` TCP-level pin L102) → a subagent scoped to explain the
*asymmetry* (why mobile only, L107) → report pairs every claim with evidence and gives
the user a falsification test with a pre-registered alternative (L119). Same shape in
`ad88fbba`: opacity bug mechanism isolated via live DOM read before the one-line fix
(L1424-29); CI failure confirmed from logs before touching anything (L2024→2050);
post-merge failure proven to be Docker Hub's 502 — "Nothing to fix in the repo" (L2494)
— no placebo commit. `932ee514`: widget-test stall root-caused by stash-bisect + byte
comparison (L1519→1546), then archived to memory (L1613).

### D4. Read the artifact, not the memory of it
`ad88fbba`: library API verified from `node_modules/r3f-globe/dist/*.d.ts` + docs fetch
**before** the first line of globe code (L370, L469→479). `42e3116a`: chased what the
TestFlight build actually shipped (Fastfile default) instead of what source suggested.

### D5. Probe state before mutating it
`ad88fbba`: `git fetch && git log HEAD..origin/...` caught a remote move before push
(L2379); blast-radius grep before `git rm` + post-delete consumer grep + fresh-build
live re-verify (L2279-2364); post-rebase sanity re-check (L2408). This is precisely the
check whose absence caused Opus's fresh-from-main worktree miss in the same session.

### D6. Steering absorbed as structure
`ad88fbba`: every steer parsed into a numbered worklist and closed item-by-item ("Voice
note parsed — four asks" L1343; "All five points from your feedback are in" L1556).
Control-session corroboration (Opus CAN do this): `97979119` kept corrective steering
≈0 via front-loaded comprehension, ONE decision-table question at the real ambiguity
(L156), and an escalating verification ladder ending in flaky-isolation proof (L395-99).

### D7. Ops resilience (encodable recipes)
`8c0bed51` Fable segment: journal-resumable 37-agent workflow; wakeup timed to the
token-limit reset (L141); salvage-from-journal instead of rerun when told to stop
(L197-207). `ad88fbba`: Monitor watchers not foreground polling (L2412); memory write +
self-contained ttr handoff at close (L2505, L4127).

### Fable anti-patterns (honest — it is not a saint)
- Verifies **presence better than aesthetics**: leader-lines legible-to-itself but not
  to the user (L1451); space-background v1 interrupted before its own screenshot pass
  (L1612-13). Both hard correctives in its flagship session.
- Silently dropped an explicit "search for references" directive (L1613 → zero
  WebSearches after).
- Relayed fix-fleet self-reported test counts without an independent orchestrator suite
  run before pushing (`8c0bed51` L3012→3023).
- Introduced a real bug in its own fix pass, caught by CodeRabbit not by its tests
  (`932ee514` L1873).
- One push-before-local-proof (`ad88fbba` L2056, self-caught, no consequence).
- Screenshot litter left in the main repo root (still in today's `git status`).
- 37-agent fan-out sized past the session token budget — needed two "please continue"
  nudges (`8c0bed51` L137/151).

### Honest nulls — where NO delta exists
Planning depth, task decomposition, convention-following, and asking-vs-assuming were
equivalent in the direct A/B (`932ee514` deltas #5-#7). Neither model ever ran the app
in that session (#8). Opus's debugging in `ad88fbba`'s own prefix was excellent (TDD,
disproved its own subagent's theory by reading `@supabase/ssr` source, L119-173) — the
gap is consistency under pressure, not capability.

---

## 4. External evidence (Pass C — web, tiered below transcripts)

Anthropic's official Fable-5 prompting guide independently converges on the same
patterns found in the transcripts, and its blocks are explicitly model-agnostic:
1. **Evidence-audited progress reports** ("audit each claim against a tool result from
   this session... nearly eliminated fabricated status reports") — matches F1/F2 ↔ D1.
   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
2. **Fresh-context verifier subagents outperform self-critique** — matches D2 (the
   user's manual "grill" habit). Same URL.
3. File-based lesson memory; de-prescription on upgrade; autonomy-boundary blocks —
   secondary support (same URL; first-hand corroboration: productcompass.pm, wavect.io).
Community material beyond the official guide is thin (model GA'd ~2 usable weeks);
Reddit not indexable; most blogs repackage the official guide. Full citations in the
Pass C agent report.

---

## 5. Candidate skills derived (→ Phase 3)

| # | Candidate | Fixes | Encodes | Evidence strength |
|---|---|---|---|---|
| 1 | `verify-before-done` — behavior-altitude + full-breadth gates + evidence-audited final report | F1, F2, F4 | D1 (+Pass C #1) | Strongest: every high-pain session exhibits the failure; Fable counter-behavior dense |
| 2 | `grill-your-own-work` — adversarial closer before done/ship | F1 (residual bugs behind green gates) | D2 (+Pass C #2) | Strong: user manually invokes this 4× on record; direct A/B outcome |
| 3 | `root-cause-first` — anomaly-is-a-lead, mechanism before fix, no second patch on same symptom, check memory for known fixes | F3 | D3, D4 | Strong: 5 independent episodes each side |
| 4 | `probe-state-before-acting` — remote/branch/cwd checks, blast radius, artifact-not-memory | F6 | D4, D5 | Medium: fewer episodes, but each cheap to encode and directly paired |

Not advanced to skills: steering-absorption (D6 — needs a live user to trap-test;
recorded here as guidance), §2.2 preflight compliance (F5 — already a written AGENTS.md
rule; a duplicate skill adds no new information, and the evidence shows the failure is
non-compliance, not absence of the rule), scope/narration (F7 — evidence says these are
mostly non-problems in this corpus), ops recipes (D7 — situational, hard to trap-test).

All four candidates go to blind validation (Phase 4): 2 planted-trap tasks × 2 arms
(Opus with/without skill) each, pre-registered rubrics, blind graders. Nothing ships on
this report alone.
