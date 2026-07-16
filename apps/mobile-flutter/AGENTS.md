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
- `bun check:filesize` (from the repo root) — the 400/200 LOC ratchet covers `.dart` files: 400 per source file, 200 per widget file (`lib/**/widgets/**`, `lib/shell/`).
- Design/UI work requires the `nham-design` skill (mobile platform: `mobile.md` — Be Vietnam Pro, calm Threads-tuned type scale), same as the root rule.

## 3. Structure Conventions

```
lib/features/<feature>/{screens,widgets,...}   — feature code (auth, circle,
                                                 dashboard, feedback, logging,
                                                 nutrition, onboarding, settings)
lib/shared/     — cross-feature widgets/helpers (second consumer required)
lib/services/   — API/auth/platform services
lib/models/     — data models (ported from web lib/*/types.ts)
lib/data/       — static data
lib/shell/      — app scaffold, navigation shell
lib/theme/      — colors, typography, spacing tokens
test/           — mirrors lib/ structure
```

- Feature-first: new code goes in `lib/features/<feature>/`, promoted to `shared/`/`services/` only when a second feature consumes it. ~8 files per folder before splitting into sub-concern subfolders. One widget per file by default; snake_case filenames. Full rubric: `thermo-nuclear-code-quality-review` skill.
- Parity work must match the web source 1:1 — interactions, transitions, and exact sizing/spacing, not just static layout.

## 4. Gotchas

- **Widget tests + l10n**: locale JSON >50KiB makes `easy_localization` isolate-decode and stall forever under fake-async. Pass `FsL10nLoader` from `test/l10n_test_loader.dart` in widget tests.
- **fastlane**: install via gem/bundler context described in `releasing.md`; the Homebrew fastlane breaks CocoaPods (reinstall pods if hit).
- **Simulator**: build from the `/tmp` mirror; iOS 26 runtime must be downloaded; ATS needs `NSAllowsLocalNetworking` for the local dev API; use idb clipboard-paste to enter text.
- **Backend**: the app talks to `/api/v1/*` on the web dev server; Drizzle decimals arrive as strings, and targets are `null` for incomplete onboarding — model accordingly.
