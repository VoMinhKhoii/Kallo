# Session Evidence Ledger — Round 2

Generated 2026-09-20 from `~/.claude/projects/*Kallo*/*.jsonl` (main checkout + worktree
and cloud-session dirs). Round 1 ([sessions.md](sessions.md)) ended 2026-07-04; this
corpus starts 2026-07-29, so the two do not overlap. Transcripts older than ~2026-07-29
were no longer on disk. Line numbers cited in [findings-r2.md](findings-r2.md) are
ORIGINAL JSONL line numbers.

Counts are tool-call counts from the main chain. "Edits" = Edit/Write tool calls only —
see the caveat under the table. "Results" = total characters of tool results returned
into context (base64 images inflate this; image tokens scale with pixels, not chars).

| Session | Dates | Model | Edits | Bash | Agents | Compactions | Results | Branch / task | PR |
|---|---|---|---|---|---|---|---|---|---|
| `67ee41da` | 07-29→08-20 | Opus | 156 | 571 | 2 | 3 | 1.2MB | Paddle + RevenueCat web billing | #242 |
| `5182cdc4` | 08-10→08-30 | Opus | 52 | 487 | 8 | 3 | 5.3MB | sibling repo `kallo-aws-analytics` + analytics migrations | #312 |
| `92b05d3b` | 08-20→08-23 | Opus | 3* | 154 | 2 | 0 | 0.3MB | Next 16.3 / TS7 upgrade (branch name misleading) | unmerged |
| `8a1d037c` | 08-21→08-22 | Opus | 18 | 201 | 0 | 0 | 0.3MB | dashboard gauge dock (Flutter) | #296 |
| `f6072383` | 08-21→08-27 | Opus | 4* | 268 | 24 | 1 | 0.4MB | premium-tier gating (web/server/Flutter/RLS) | #303 |
| `586b1841` | 08-26→08-28 | Opus | 20 | 300 | 0 | 1 | 1.8MB | web gauge/arc strip redesign | #309–311 |
| `cc03e22b` | 08-28→08-29 | Fable | 36 | 141 | 22 | 0 | 0.2MB | notification system (fork of 4d52b915) | #313–315 |
| `4d52b915` | 08-28→09-07 | Fable 5.1 | 18 | 201 | 15 | 1 | 0.6MB | notification system → iOS APNs push | #343 |
| `346d3ece` | 08-30 | Fable | 81 | 212 | 3 | 0 | 0.4MB | meal-pipeline prompt locale split | #317–321 |
| `21d1773a` | 08-31→09-01 | Fable | 38 | 203 | 19 | 1 | 3.5MB | iOS-native design pass regressions | #329 |
| `06199779` | 09-01→09-02 | Fable 5.1 | 8 | 37 | 5 | 0 | 0.2MB | API rate-limit plan + PR 1 | — |
| `4b54de9b` | 09-01→09-02 | Fable 5.1 | 8 | 172 | 19 | 0 | 0.4MB | rate-limit foundation, 3 stacked PRs | #330–332 |
| `f3074584` | 09-05→09-08 | Fable 5.1 | 4* | 438 | 26 | 2 | 30.0MB | onboarding/pricing canvas → Flutter build | #342 |
| `56cfd62e` | 09-15→09-17 | Opus | 32* | 580 | 0 | 1 | 10.2MB | meal-share redesign | #356 |
| `82d805ca` | 09-19→09-20 | Opus | 3* | 210 | 4 | 0 | 0.8MB | weight chart restyle (web + Flutter) | #362 |

\* **Edit counts marked `*` are an artifact.** These sessions wrote and patched files
through Bash (`cat > f <<EOF`, `python3 … s.replace(...)`, `sed -i`) — e.g. `56cfd62e`
ran 145 python heredocs, 82 of them `.replace()` edits, so its true edit count is ~180.

## Corpus hygiene

- `9081d08c` is a byte-for-byte prefix of `21d1773a` (same session, L-numbers offset) —
  excluded, not double counted.
- `4d52b915` and `cc03e22b` are forks: L3–L389 are identical and cited once as "both".
- `5182cdc4` was launched from the Kallo repo but almost all of its work happened in a
  sibling repo; only its `supabase/migrations` work touches Kallo. Web conventions
  (bun/Biome/structure gate) cannot be judged there.
- `858fd197` (this distillation session) is excluded — no self-citation.
- Excluded as trivial: sessions with <3 edits and <5 human messages.

## Skill-listing visibility (why usage counters read "never")

In 11 of the 19 active Kallo sessions since 2026-07-29 the skill listing carried
`decision-gate`, `probe-state-before-acting`, `root-cause-first` and
`verify-before-done` as bare names with NO description (the listing was over its
budget with ~150 installed skills; `feature-workflow`, `grill-your-own-work` and
`delegate-and-verify` kept theirs). Discipline skills fired in 7 of the 8 sessions
where descriptions were present and in 1 of the 11 where they were not. In `67ee41da`
the skills were additionally untracked files on main (L785) and likely unregistered.
73 unused personal skills were switched off on 2026-09-20, which restored the
descriptions; treat all "never invoked" counts before that date as partly a listing
artifact. `feature-workflow` is the exception: described in all 19, invoked in 0.
