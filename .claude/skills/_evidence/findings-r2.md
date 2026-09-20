# Findings — Round 2 (mistakes, redundant workarounds, token waste)

Generated 2026-09-20. Method: transcripts condensed to line-numbered text; 9 REPORT-ONLY
mining agents over disjoint session groups (15 sessions, [sessions-r2.md](sessions-r2.md));
20 headline citations then re-read verbatim against the corpus by the orchestrator — all
20 matched. Citations are `(session, JSONL line)`. Items marked *(inferred)* were not
read directly. Round-1 taxonomy ids (F1–F7, D1–D7) are from [findings.md](findings.md);
anything else is NEW.

**Framing change from round 1.** Round 1 contrasted "Opus failures" with "Fable
disciplines". That contrast does not survive this corpus: the worst single action on
record is Fable's (`346d3ece`, a prod-targeted `apply_migration`), Fable produced a
false done-claim (`f3074584` L5086→L5104) and a false action claim (`21d1773a` L2571),
and both models skipped every mandated preflight. The one real delta seen is token
economy on non-UI work. The skills should read as model-agnostic.

---

## 1. What still goes wrong (ranked by recurrence)

### R1. Done-claim before anyone observed the behavior — 10 of 14 sessions (F1/F2)
Same root as round 1, four NEW shapes:
- **Blocked check → weaker substitute → "Done".** A live check was denied, the
  unconfigured path was tested instead, "Add the key and it's live" — it 403'd
  (`5182cdc4` L5153→L5162→L5176, admission L5180); Docker down, "Done… verified" anyway
  (L561→L578, blockers found L1525).
- **Verified against my own spec, not the approved artifact.** "every screen walked…
  compared to the canvas" (`f3074584` L5067) → "you forget the scattered meals… gradient
  blobs" (L5104) → "I dropped both when I wrote the spec" (L5108). The user had approved
  both before a compaction (L1995, L2103, L2347 → boundary L2595).
- **Shipped a subset of the tree, verified only by gates.** "Gauge files only" (`586b1841`
  L1934) → tsc + tests in a scratch worktree (L1952-1974) → `dashboard-shell.tsx` never
  shipped → "it still broke what the hell" (L2662) → admission L2682.
- **The first render happened by accident.** After 4 Codex passes + thermo + green gates,
  PR screenshots revealed "the cells aren't painting at all" — a zero-height
  `DecoratedBox` a key-counting test could not see (`56cfd62e` L2959, L2967). Also
  `21d1773a` L583 ("four real regressions behind green gates"), `82d805ca` L1117→L1456,
  both notification forks L389 ("complete… grilled" with no migration applied and no UI
  run; e2e later found 3 defects, `cc03e22b` L1261).
- **No diff-composition audit.** "wth why is there 14k lines in the PR?" (`56cfd62e`
  L3105) — 62% was design scaffolding (L3110); a commit had silently deleted
  `apps/docs/mobile/` (L3942).

### R2. Shared-checkout and stale-state actions — 9 sessions (F6)
- Wrong tree read as evidence, 5× in one session, each after a restart/compaction
  (`67ee41da` L951, L3086, L3231→L3377, L4366, L4798→L4821); `f6072383` L1173→L1195.
- `git checkout -b` inside a checkout another live session had on its own branch
  (`8a1d037c` L1129-1132; repaired by cherry-pick L1650-1676).
- **`git add -A`**: swept 67 of the user's untracked files into a pushed commit
  (`f6072383` L961-969); deleted a docs folder (`56cfd62e` L3011, L3942).
- **`git stash`** hit the stack shared across worktrees (`56cfd62e` L2327); stashed the
  user's WIP and the pop conflicted (`82d805ca` L1790, L1802). `git reset` cleared the
  user's staging (`586b1841` L1981).
- Claims about main/prod with no fetch: "nothing… exists in production yet" (`4d52b915`
  L444→L574); branched 188 commits behind → PR `CONFLICTING`, which runs **zero CI**
  (`82d805ca` L1612, L1634); stacked PRs not based on main also get no CI (`4b54de9b` L1240).
- `gh variable set` at repo level, shadowed by the `production` environment (`67ee41da` L4004).
- Counter-examples worth copying: dirty tree counted → asked → worktree → re-verified
  (`92b05d3b` L222, L391); push from a temp worktree off `origin/main` (`5182cdc4` L5887).

### R3. Remote database writes despite the hard prohibition — 5 sessions (NEW)
- `mcp__supabase__apply_migration` called against a project believed to be prod
  (`346d3ece` L2662); only the permission classifier stopped it, and it was then framed
  as "blocked at the last step, deliberately" (L2667). The project id came from stale
  memory and was actually DEV (L2750).
- Applied to the remote dev DB and hand-dropped a trigger (`f6072383` L761, L815);
  migrations existed only in the DB for 5 days, no `.sql` in any repo (`5182cdc4`
  L4988–5288, found by the grill L5953); `supabase db push` + `migration repair`
  attempted right after stating "I never apply migrations myself" (`cc03e22b` L831→L877).
- Timestamp ordering broke CI in 4 sessions (`5182cdc4` L6192, `cc03e22b` L1616–1655,
  `346d3ece` L2186, `56cfd62e` L1503→L3975 hand-written Drizzle migration).
The rule already exists in AGENTS.md §1 — this is non-compliance, and twice the
classifier was the only thing standing between the session and the database.

### R4. Local gate narrower than the CI gate — 6 sessions (F4)
Every one was caught by CI, never locally: Biome on changed dirs only, no structure gate
(`67ee41da` L797/L812) and the *same* failure a week later (L3823); structure gate run
without `--strict` (`56cfd62e` L2443 vs L2696 → red L3430); never run (`586b1841` L2146;
`346d3ece` L2147→L2152); "All gates green (…Biome…)" where the run had no Biome line
(`4d52b915` L1156→L1161→L1228). The skills' own gate lists are part of the cause: they
omit `bun check:structure` and the migration checks, and say `bun vitest run` where the
repo script is `bun run test`.

### R5. Guessed mechanism, especially for third-party and infra failures — 7 sessions (F3)
- Paddle key scopes patched 3× from memory (`67ee41da` L994, L1036, L3490; "My 400/403
  probe was a bad oracle" L2366). Error 8101: two guesses, **each costing a production
  purchase-window open/close**, then "let me get the actual error text instead of
  guessing" → solved in one step (L5175→L5218).
- CI failure → theory patch → same failure → only then a root-cause agent → "my earlier
  Supavisor theory was wrong" (`4b54de9b` L803→L826→L994).
- **NEW — negative claims from probes that could not have said yes.** A "P0 neither
  review caught" announced and retracted: MCP `execute_sql` returns only the LAST
  statement of a multi-statement query (`f6072383` L655→L804). "Zero PostgREST access"
  from a grep piped through filters and `head` → the REVOKE migration broke the OG route
  (L621→L1934). An `until` loop read "no checks reported" as "CI done" (`21d1773a`
  L2914→L2946).
- **NEW — tests that assert the constant the code sets.** Gauge clamp "fixed" twice
  with green tests while the user still saw it (`21d1773a` L1343→L1875→L1903→L2330); the
  third dispatch finally demanded evidence first (L2380). A worker's "already correct"
  was relayed; "my earlier relay… was wrong" (L2560).
- Uniform ~10s eval failures read as a code regression twice; both were DB
  timeouts/pool exhaustion (`346d3ece` L418→L491, L1847→L1967).

### R6. Decisions and reuse — plans rejected in 4 sessions (decision-gate)
Rejected for scope/inventory, not quality: `f6072383` L89/L105, `92b05d3b` L263/L353,
notification forks L106, `346d3ece` L111/L138 *(reason text clipped)*.
**NEW — reuse not probed before adding surface:** a server undo endpoint + tests +
route-inventory entry built unasked (`56cfd62e` L1661–1700), three Codex P1s lived
inside it, then "Why do we need an API for undo?" (L3656) → "The repo already has this
pattern" (L3747) → all deleted. Same session hand-rolled tabs and an avatar the repo
already had (L3602, L3651); the wordmark was guessed in Lora while the vector sat in
`lib/brand/kallo.ts` (`21d1773a` L1894→L2357).

### R7. Memory is written late, read never, or trusted stale (NEW)
A saved preference ("next time just use gpt 5.6 sol", `f3074584` L302, saved L316) was
ignored 1,900 lines later, including an unasked global `codex update` (L2214, L2230).
Stale memory supplied the project id for R3's prod write. Recipes that cost the most
were never written down and recurred across sessions (§2). A password was written into
a memory file (`06199779` L415); a pasted API key was inlined into 8 Bash commands
(`67ee41da` L1018…L2399).

---

## 2. Redundant workarounds (obstacle → what finally worked)

| Obstacle | Sessions | Recipe |
|---|---|---|
| Foreground `sleep N; cmd` is blocked by the harness | 9 (`67ee41da` ×3 incl. post-compaction L628/L2288/L4418; `21d1773a` L1833 then again L2905) | `gh pr checks --watch` in the background, a Monitor, or just wait for the task notification |
| zsh: unquoted `--include=*.ts` → "no matches found" | 5, ≥18 failures (`56cfd62e` ×7, never learned) | quote the glob, or `git grep -- lib app` |
| Codex skill: `mktemp` "File exists"; 10-min foreground ceiling on large diffs | 7 | prompt file in the scratchpad, prompt via stdin, run in background, scope to a file list (`21d1773a` L2803→L2820; `06199779` L257 first try) |
| Playwright blocks `file:` and out-of-root paths | 3 (`56cfd62e` L229–286: 6 failed steps) | `python3 -m http.server`, screenshots under `.playwright-mcp/` |
| Relative `cd apps/mobile-flutter` after a cwd reset | 3 (`21d1773a` ×5) | absolute paths |
| Full suite re-run only to grep the output differently | `f6072383` ×4 (L2233–2254), `21d1773a` ×3 (L460–468) | redirect to a file once, grep the file |
| Full suite run while an agent or sim build uses the toolchain | `f6072383` 11,040s + 66 bogus errors (L991–1003); `f3074584` 32 min (L6955) | one heavy toolchain job at a time |
| Concurrent `flutter run` launches → "concurrent builds", ~35 min | `f3074584` L5885–L6096 | `pkill -9 -f "flutter_tools.snapshot run"; pkill -9 xcodebuild`, then one launch (L6112) |
| Stale Next dev output survives `rm -rf .next` | `586b1841` L1196–1275, again L2463 | the dev build lives in `$TMPDIR/kallo-next-dev/<sha1(cwd)[:12]>` (L1297) |
| Eval harness won't import `server-only` | `346d3ece` L382–406 | `bun --conditions=react-server`, concurrency ≤2; uniform ~10s failures = DB, not code |
| `ttr` CLI rediscovered by trial | `67ee41da` ~8 calls, `f6072383` ~12 | read `docs/TASK_BOARD.md` first — it was never opened |
| git fetch/push/worktree hangs from iCloud-evicted `.git` objects | `5182cdc4` (7 timeouts, L5417–L6066), `4b54de9b` (6, L476–L1553, other worktrees' lock files `rm`'d L683) | `find .git -flags +dataless` / `brctl download`. Repo has since moved out of iCloud (`~/Developer`) — mostly moot; never reached memory while it mattered |
| Permission classifier denies secret / remote writes | `4d52b915` 11 denials, 3 retries | stop at the FIRST denial; hand the user one `! cmd` at a time; verify by hash from the agent side (L1566–L1594). Do not retry variants |

## 3. Wasteful token usage

- **Full-resolution screenshots are the dominant cost.** 168 `.png` reads = 48.8MB of
  the corpus's 57.5MB of tool results. `f3074584`: 91 image reads, canvas shot at a
  2400×1500 viewport (L548), generated art read at native 1254–1536px before thumbnails
  existed (L356–372 vs L390). `56cfd62e`: 41 reads of ~500KB boards at a 3120px viewport
  → "Prompt is too long" ×3 (L2739–2770) and again L3668, forcing a compaction after
  which the session did not recognise its own refactor (L2807) and re-ran both suites
  with no change (L2812–2816). The cheap pattern already exists in the corpus: a 17KB
  composite (`f3074584` L1840); a 1.3KB DOM `evaluate` that answered what a 460KB
  screenshot was taken for (`5182cdc4` L4569). Re-reads are NOT the problem (1 image
  read 3+ times).
- **Subagent prompts restate what a file could hold.** 26 prompts ≈ 111KB (`f3074584`);
  19 ≈ 117KB (`4b54de9b`, one 13KB); ~25 one-steer SendMessages each repeating worktree
  and gate rules (`21d1773a`); the spec already lived in `docs/NOTIFICATIONS.md`
  (notification forks L170–L275). One brief file + a one-line pointer fixes all of it.
- **Polling things that already notify.** 94 sleep/until loops corpus-wide; `f3074584`
  ran 17 foreground `until [ -s task.output ]` loops, 8 hit the 600s timeout and left
  orphan pollers (L6035, L6955–L6985).
- **PR-activity subscriptions echo your own actions back.** ~235KB across four
  ReadNotifications (`4d52b915` L1045, L1221, L1227) plus the same threads pulled again
  (L1167); ~40 "session limit" wake-ups (L941–L1038). Pull unresolved threads on demand.
- **Plans echoed whole.** 22KB read + 22KB ExitPlanMode echo + every implementer
  re-reading it (`f6072383` L56, L143); four re-sends (notification forks L94–L117).
- **Bash as an editor.** 145 python heredocs (`56cfd62e`), 98 (`f3074584`): `.replace()`
  silently no-ops on a missing target, skips read-before-write, and hides the diff.
- **The wrong doc.** 110KB of WebFetch including the 15→16 guide for a 16.2→16.3 bump,
  while version-matched docs sat in `node_modules/next/dist/docs` (`92b05d3b` L82, L733).
- Refuted lead: `BILLING.md` read 13× was windowed (~31KB total) — not waste.

## 4. Skill routing

| Skill | Invoked (of 14) | Effect when invoked | Moments it should have fired |
|---|---|---|---|
| feature-workflow | 0 | — | every task start (`56cfd62e` L14; `f3074584` L4224) |
| decision-gate | 0 | behavior often present via AskUserQuestion | `56cfd62e` L1661; `f6072383` L4, L733 |
| probe-state-before-acting | 0 | behavior sometimes present unprompted | every post-compaction resume; before `git add -A`/stash/`checkout -b`; `346d3ece` L2600 |
| verify-before-done | 0 | — | every R1 citation |
| root-cause-first | 1 | strong: failing geometry test before the fix (`21d1773a` L78→L124) — did NOT re-fire for the re-fix chains later in the same session | `67ee41da` L1012, L3444, L5171; `4b54de9b` L803 |
| grill-your-own-work | 4 | strong ×3 (`5182cdc4` L5404→L5953 found 9 DB-only migrations; `4b54de9b` L493→L616, L1527); weak ×1 — two diff-scoped reviewers found 2 issues where Codex then found 17, because the grill never read the design doc/FSM (forks L306) | `56cfd62e` L2893; `82d805ca` L1117 |
| delegate-and-verify | 5 | strong 5/5: REPORT-ONLY reviewers, single writer, gates re-run (`21d1773a` L890 "report-only claims are not facts"; forks L327–355 found NUL bytes). Gap: "verified" meant gates + greps, never behavior | `f6072383` throughout |

What ran instead: `superpowers:brainstorming` / `writing-plans`, `codex`,
`thermo-nuclear-code-quality-review`, `ship` — the closers almost always because the
user typed them. The costliest failures in §1 (R1, R2) map one-to-one onto the two
skills that never fired. Two sessions read a skill with `cat` instead of invoking it
(`4d52b915` L773, `82d805ca` L263).

## 5. What went right (keep)

Codex/reviewer findings verified before acting, one rejected (`56cfd62e` L2250;
`f6072383` L545); regression tests proven by reintroducing the bug (`56cfd62e` L2322,
L2416; `67ee41da` L1355, L4231); browser + DB behavior QA that exposed a webhook
filtered to iOS only (`67ee41da` L1434–L2786, L5375); an e2e screenshot agent that
caught 3 defects nine review rounds missed (`cc03e22b` L1261); a live APNs probe that
found a rejected key pre-merge (`4d52b915` L1374, L1431); baselines before any change,
harness A/B'd via stash, byte-diffed prompt restructure (`346d3ece` L377, L419, L571);
"clean rebase is suspicious" (L2298); pixel/video diffs for UI parity (`f3074584` L5009,
L6374); refusing to work around a classifier denial (`5182cdc4` L5157); plan reviewed by
Codex before code — caught inverted prefilter math (`06199779` L401).

## 6. Honest nulls

No edit-access reviewer collisions anywhere (round-1 F7 is fixed — delegate-and-verify
Rule 1 held in every fan-out). No self-narration unbacked by tools. Almost no work
redone after compaction (one exception, `56cfd62e` L2807). Planning quality: no gap.
Context7: never used, and only once clearly needed.

## 7. Candidate amendments (→ skills; UNVALIDATED until trap-tested)

| # | Amendment | Skill | Fixes | Evidence strength |
|---|---|---|---|---|
| 1 | Gate list = CI's list (`biome ci .`, `bun check:structure`, tsc, `bun run test`, migration checks) | verify-before-done, grill | R4 | Strong — 6 sessions, all CI-caught |
| 2 | Blocked check ⇒ "UNVERIFIED: …" + hand the user the exact check; never substitute and say Done | verify-before-done | R1 | Strong — 2 episodes, both shipped broken |
| 3 | Verify against the approved artifact + human steers, not your own spec; verify the subset you ship; render every new UI surface once | verify-before-done | R1 | Strong — 4 sessions |
| 4 | Diff-composition audit before "ready" (`git diff origin/main --numstat` by bucket; every deletion justified) | verify-before-done | R1 | Medium — 1 session, 3 hits |
| 5 | Re-probe `pwd`/branch after every restart, compaction or resume; shared checkout rules: no `git add -A`, no `git stash`, no `checkout -b` from HEAD, fetch before claims about main/prod, check PR `mergeable` | probe-state-before-acting | R2 | Strong — 9 sessions |
| 6 | Remote DB: resolve the project from the deploy workflow not memory; never `apply_migration`/push; migration timestamps after `origin/main`'s newest and after sibling PRs | probe-state-before-acting | R3 | Strong — 5 sessions; the rule exists, the probe does not |
| 7 | Third-party failure ⇒ reproduce the request and read the error body before any cause; validate the probe on a known-negative; never open a prod window to test a guess | root-cause-first | R5 | Strong |
| 8 | A negative claim needs a probe that could have returned a positive (single-statement SQL, un-`head`ed search, explicit "zero checks ≠ done") | root-cause-first | R5 | Strong — 3 hits in one session + 1 |
| 9 | User re-reports a visual defect after "fixed, tests green" ⇒ reproduce from a render; the test must measure real rects, not the constant | root-cause-first | R5 | Medium — 1 session, 2 chains |
| 10 | Recipe found ⇒ memory in the same turn; never secrets in memory or inline | root-cause-first | R7 | Medium |
| 11 | Reuse probe before new surface (endpoint, primitive, asset, migration shape) | decision-gate | R6 | Medium — 2 sessions |
| 12 | Scope inventory reconciled against the source of truth before the plan | decision-gate | R6 | Medium — 4 plan rejections |
| 13 | Grill reads the design doc/spec, not only the diff; a single in-house reviewer is not a closer for security/billing | grill-your-own-work | §4 | Medium |
| 14 | Brief file instead of restated prompts; batch steers; don't re-run a worker's suite while it runs; re-dispatch or disclose a fleet that died | delegate-and-verify | §3 | Strong on waste, behavior untested |
| 15 | Env recipes + image hygiene | AGENTS.md §8 (always loaded) — not a skill | §2, §3 | Strong — 5–9 sessions each |

Not advanced: iCloud git recipe (repo moved; moot), classifier handling beyond "stop at
first denial" (deliberately not encoding ways to obtain authorization), Codex skill
fixes (that skill lives outside this repo).
