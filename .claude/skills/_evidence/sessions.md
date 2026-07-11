# Session Evidence Ledger

Generated 2026-07-04 from `~/.claude/projects/-Users-khoivo-Documents-nham/*.jsonl`.
"Steer" = human-typed text messages (excludes tool results, `<system-reminder>`/hook
noise, interrupts, and command caveats), counted per message via jq. The first message
is the task prompt, so steering pressure ≈ steer − 1. Pain metric per user: sessions
that needed steering / PRs that couldn't merge in one go.

## Sessions (main project dir)

| Session | Dates | Fable | Opus | Steer | Branch (top) | Title | PR |
|---|---|---|---|---|---|---|---|
| `8c0bed51` | 06-10→06-26 | 159 | 2148 | **54** | main, refactor/structure-cleanup | harden-meal-card-actions | #159 |
| `47ea3a99` | 06-29→06-30 | 0 | 836 | **54** | claude/native-google-signin-mobile | Google sign-in validation | #163 |
| `ad88fbba` | 07-03→07-04 | **1416** | 228 | 47 | claude/landing-page-redesign | v3-landing-globe-interactive | #181 |
| `8a61a242` | 07-01→07-02 | 0 | 1150 | 26 | worktree-threads-typography-dashboard | apply-calm-design-system-mobile | #175/#177 |
| `80a56ca1` | 06-30→07-01 | 0 | 925 | 23 | mobile-weight-chart-redesign | weight chart redesign | #171 |
| `f56af273` | 06-06 | 0 | 320 | 13 | feat/mobile-flutter | Flutter sim progress | #153 |
| `40be176f` | 07-01 | 0 | 19 | 13 | feat/barcode-serving-size | TestFlight teammates | — |
| `8013b7ec` | 07-01 | 0 | 302 | 11 | feat/barcode-serving-size | (barcode review fixes) | #162/#170 |
| `ca3ab2c1` | 07-03→07-04 | 0 | 456 | 11 | worktree-fix+supabase-auth-vn | Supabase API gateway | #183 |
| `932ee514` | 07-01→07-03 | **361** | 311 | 8 | worktree-circle-mobile-port | circle-port-logic-bugs-fix | #180 |
| `bf4eb0ac` | 07-04 | 14 | 325 | 5 | chore/ttr-task-templates | share-meal-copy-split | (open) |
| `83d4b9bf` | 07-04 | 14 | 327 | 3 | chore/ttr-task-templates | in-app-feedback-capture | (open) |
| `42e3116a` | 07-02 | 46 | 0 | 2 | chore/ttr-task-templates | mobile outage investigation | — |
| `97979119` | 06-30→07-01 | 0 | 191 | 2 | main | review sharing/meal defaults | #166 |
| others | — | — | — | ≤3 | — | ttr/minutes/small ops tasks | — |

Excluded as evidence: `69bbde8c` (this distillation session — no self-citation),
`bae87b08`, `9ebfce35` (trivial), `502e645d`/`63134f58`/`67078231`/`c1ca2ef5` (ttr CLI
ops chores, minimal engineering content — steer counts near zero).

## Branch → PR → merge outcome

| PR | Branch | Merged | One-go? | Post-merge/post-"done" chain (Claude-authored) |
|---|---|---|---|---|
| #170 barcode | feat/barcode-serving-size | 07-01 | **No** | `f7ac129`, `dfc6e89`, `80b3322` (3 review-fix rounds, author Claude); then `27fabb9`, `15ac220`, `031518a` same-day post-merge |
| #163 google sign-in | claude/native-google-signin | 06-30 | session had 54 steers | grill target |
| #175/#177 typography | worktree-threads-typography | 07-02 | **No** | log-weight 4-fix chain `e5b84dc`→`42a57c7`→`b0caf57`→`a0ca934` (author Claude, ~same day) |
| #171 weight chart | claude/mobile-weight-chart | 07-01 | 23 steers | grill target |
| #180 circle port | worktree-circle-mobile-port | 07-02 | 8 steers (mixed Fable/Opus) | session continued post-merge to 07-03 fixing logic bugs |
| #181 landing globe | claude/landing-page-redesign | 07-03 | 47 steers (Fable; design iteration) | 1 CI fail→pass retry 07-03 |
| #159 structure cleanup | refactor/structure-cleanup | 06-26 | part of 16-day `8c0bed51` | grill target |
| #183 auth proxy | fix/supabase-auth-vn | 07-03 | 11 steers | — |

## Attribution exclusions (NOT Claude-session evidence)

- `c3ab556`, `c67635c`, `e5d2a9a` — `(bug)`/`(fix)` convention-violating commits: author HuynhMaiThienAn (human).
- `1863ada` harden-meal-card commit: author VoMinhKhoii; however session `8c0bed51` (ai-title `harden-meal-card-actions`) is the matching Claude session and IS in corpus.
- `9ca5d7a`, `d66dc02` migration UTC fixes: author Vo Minh Khoi (human commit; whether a Claude session produced the bad migration is checked in Pass A via `8013b7ec`).
- Revert batch `e0fe5ae`/`e7a74bc`/`ee47311` (06-15): author VoMinhKhoii; predates most corpus sessions — origin uncertain, excluded unless a transcript claims it.
- PR #156 (feat-manual-logging, chelrmit27) — human parallel implementation; excluded.

## Errata (corrections from deep grills, 2026-07-04)

1. **Migration UTC fixes `d66dc02`/`9ca5d7a` are Claude-session work**, not human: session
   `8013b7ec`'s summary claims the identical diagnosis/fix, and those commits predate the
   session's stop-hook git-identity fix (later commits are authored `Claude`). The
   back-dated migration itself WAS human-created (`73932a8`, teammate, Jun-14).
2. **The log-weight 4-fix chain did not happen in `8a61a242`** — all four commits came
   from simulator-less Claude Code **cloud** sessions across PRs #171/#173/#174 over ~7h
   (a0ca934 is chronologically first; its timestamp is +07). No local transcript exists,
   so it stays a git-level inference: geometry axes patched piecewise, user's device as
   the only verifier between PRs.
3. **Raw steer counts overcount replays**: `8a61a242` = 12 unique human inputs (26 raw
   double-counts a compaction replay); `ad88fbba` = 17 unique (47 raw; the JSONL contains
   the full history twice after a continuation summary at L4060), ~708 unique Fable msgs.
4. `40be176f` is not a barcode session (TestFlight onboarding Q&A + a timetable task);
   its branch field is incidental.

## Notes on steering-rate by model (raw, uninterpreted)

Steers per assistant message: Opus sessions — 47ea3a99 6.5%, 8a61a242 2.3%,
80a56ca1 2.5%, 8c0bed51 2.3%, ca3ab2c1 2.4%. Fable-dominant — ad88fbba 2.9% (long
creative-direction session), 932ee514 1.2% (mixed). Raw rates do NOT separate the
models; the corrective-vs-directive character of each steer is what Pass A/B classify.
