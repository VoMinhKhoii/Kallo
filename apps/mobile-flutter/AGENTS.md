# AGENTS.md — Flutter App (`apps/mobile-flutter`)

Rules for everything under this directory. The web rules in the root `AGENTS.md` (TanStack Query, shadcn, Tailwind, Biome, bun test, …) do **NOT** apply here. Root prohibitions on secrets and remote DB pushes still do.

## 1. Read First

Before developing or releasing, read `apps/docs/mobile/`:
- `development.md` — local run loop (`bun dev:mobile` from the repo root, or `./tool/run_dev.sh` here), env/dart-defines, the iCloud→`/tmp` mirror + codesign caveat, CocoaPods gotchas.
- `releasing.md` — TestFlight pipeline: `fastlane ios beta`, manual signing scoped to the Runner target, export compliance.
- `architecture.md` — app structure and web-parity mapping.

Builds run from a `/tmp` mirror (iCloud file-provider breaks codesigning) and ship via fastlane — **not** the web `bun`/EAS flows.

## 2. Gates

- `flutter analyze` and `flutter test` — after each coherent chunk, and always before signing off.
- `bun check:structure` (from the repo root) — the 400/200 LOC ratchet covers `.dart` files: 400 per source file, 200 per widget file (`lib/**/widgets/**`, `lib/shell/`).
- Design/UI work requires the `kallo-design` skill (mobile platform: `mobile.md` — Be Vietnam Pro, calm Threads-tuned type scale), same as the root rule.

## 3. Structure Conventions

```
lib/features/<feature>/          — feature code (auth, circle, dashboard, feedback,
  screens/                         logging, nutrition, onboarding, paywall, settings)
  widgets/[<sub-concern>/]       — presentation; sub-concern subfolders when it grows
  logic/                         — pure functions and BuildContext action helpers
  data/                          — Riverpod providers and feature-static tables
  providers/                     — Riverpod wiring
lib/shared/     — cross-feature widgets/helpers (second consumer required)
  widgets/<m>/                     — one folder per primitive: avatar/ brand/ calorie_ring/
                                     feedback/ form/ motion/ sheet/ surface/ toast/
                                     typography/. No loose files at widgets/ root.
  logic/ data/
lib/services/   — infrastructure edges, one subfolder per concern:
                  http/ (api_client, uploads, query cache policy), auth/
                  (supabase_service, session_provider), billing/, analytics/, env/
lib/models/     — data models (ported from web lib/*/types.ts), grouped by domain:
                  nutrition/, logging/, social/, profile/
lib/shell/      — app scaffold and navigation shell: header/ (the in-flow app bar
                  and its slots), sidebar/ (the left drawer), plus tab_scaffold.dart
                  and placeholder_screen.dart — the two routed surfaces the shell
                  itself hands the router
lib/theme/      — colors, typography, spacing tokens — the reference shape
test/           — mirrors lib/; only widget_test.dart, app_fonts.dart and
                  l10n_test_loader.dart sit at its root
```

- No `lib/data/`. It claimed to hold static data and actually held the HTTP client, analytics, env, session and billing; it merged into `lib/services/`. Static tables live with their consumer (`features/<f>/data/`) or in `lib/shared/data/`.
- No `controls/` or `panels/` folders. Both held widgets, which put them outside the CI gate's `/widgets/` component path and silently raised their budget from 200 to 400 lines. Widgets live under `widgets/`, screens under `screens/` — nothing else.
- Feature-first: new code goes in `lib/features/<feature>/`, promoted to `shared/`/`services/` only when a second feature consumes it. Aim for one concern and ≤10 files per folder (subfolders don't count) before splitting into sub-concern subfolders. One widget per file by default; snake_case filenames. Full rubric: `thermo-nuclear-code-quality-review` skill.
- No feature-root loose files: every `.dart` under `lib/features/<feature>/` sits in a sub-concern folder.
- **No barrels — and a re-export may not cross a folder.** The root `AGENTS.md` bans re-export hubs; Dart is no exception, and the structure gate's barrel rule only scans `.ts`, so this one is on you. Two shapes, one rule:
  - A file whose whole job is `export '…';` lines is a barrel — delete it and let callers import the file they need. `shared/widgets/widgets.dart` was exactly that (7 re-exports, 5 importers) and is gone. Its cost: `SectionEyebrow`, `Screen` and `TargetProgressBar` had no direct importer anywhere, so nothing could tell you who actually depended on them.
  - A real module **may** re-export a file in its own folder — that is the folder's public entry speaking for its own internals (`toast/top_toast.dart` → `top_toast_pill.dart`, `surface/kallo_primitives.dart` → `kallo_screen.dart`). It may **not** re-export another folder's module: `dashboard/widgets/states/card_skeletons.dart` and `circle/widgets/states/friend_list_skeleton.dart` both re-exported `shared/widgets/feedback/skeleton.dart`, which let dashboard and circle widgets reach a shared primitive through a feature file. Both re-exports were removed.
- `test/` mirrors `lib/`, and the mirror collapses the `widgets/`/`logic/` layer: a test lives in the folder its subject lives in — `test/features/<f>/[<sub-concern>/]`, `test/services/<concern>/`, `test/shared/<layer>/`. The block above claimed this mirror while most test files sat flat at the root, so the claim was worth nothing as a gate; they were moved and it is now true. Exactly three files stay at the root: `l10n_test_loader.dart` and `app_fonts.dart` (helpers any test may reach for — §4 quotes the l10n path, so it must not move), and `widget_test.dart`, which boots the whole app and therefore mirrors nothing.
- Sub-concern folder names are shared vocabulary, not per-feature invention. `states/` is the loading/error/empty states of a surface (circle, dashboard, nutrition all use it); `chrome/` is a surface's own furniture — its header, its navigator, the bar it always shows.
- Parity work must match the web source 1:1 — interactions, transitions, and exact sizing/spacing, not just static layout.

## 4. Gotchas

- **Widget tests + l10n**: locale JSON >50KiB makes `easy_localization` isolate-decode and stall forever under fake-async. Pass `FsL10nLoader` from `test/l10n_test_loader.dart` in widget tests.
- **fastlane**: install via gem/bundler context described in `releasing.md`; the Homebrew fastlane breaks CocoaPods (reinstall pods if hit).
- **Simulator**: build from the `/tmp` mirror; iOS 26 runtime must be downloaded; ATS needs `NSAllowsLocalNetworking` for the local dev API; use idb clipboard-paste to enter text.
- **Measuring text width in a widget test requires `loadAppFonts()`** (`test/app_fonts.dart`). Without it every glyph renders in a ~1em placeholder: "CHẤT BÉO" measures 90pt instead of 59pt, which is enough to fail a layout that is fine — and, in the other direction, to pass one that is not.
- **Discarding a staged meal is mobile-only.** `DELETE /api/v1/meals/pending/[analysisId]` and the trash affordance on `StagedMealCard` have no web counterpart yet, so the two feeds are NOT 1:1 here. Web staged cards still exit only by being confirmed.
- **Backend**: the app talks to `/api/v1/*` on the web dev server; Drizzle decimals arrive as strings, and targets are `null` for incomplete onboarding — model accordingly.
