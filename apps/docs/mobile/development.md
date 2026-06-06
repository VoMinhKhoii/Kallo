# Mobile — Development

How to run and iterate on the **Flutter** app (`apps/mobile-flutter`) locally.

## Prerequisites

- **Flutter** 3.44+ (`flutter --version`) and the iOS toolchain (`flutter doctor`)
- **Xcode** 26+ with an iOS Simulator runtime installed
- **CocoaPods** (installed; see [the CocoaPods gotcha](#gotcha-cocoapods-breaks-after-a-ruby-bump))
- The **`/api/v1` backend** running locally if you want real data (see [Backend](#backend))

## Quick start

```bash
cd apps/mobile-flutter
./tool/run_dev.sh
```

`tool/run_dev.sh` does everything:

1. Mirrors the app to `/tmp/nham-flutter` (out of iCloud — see below).
2. Boots / reuses an iOS Simulator.
3. Reads dev Supabase creds from a `.env.local` (the repo root, or a sibling worktree).
4. Runs `flutter run` with the **dev** `--dart-define`s (localhost API + dev Supabase).

Then use the live keys in that terminal: **`r`** hot reload · **`R`** hot restart · **`q`** quit.

### Editing during a session

The app runs from `/tmp/nham-flutter`, so hot reload watches **that** copy. Edit files there while iterating, then sync your changes back into the repo before committing:

```bash
./tool/run_dev.sh back        # rsync /tmp/nham-flutter -> apps/mobile-flutter
git status                    # review, then commit
```

(If you prefer editing in the repo, re-run `./tool/run_dev.sh` to re-mirror and cold-start.)

### Overrides

`run_dev.sh` honours these env vars:

| Var | Default | Purpose |
|-----|---------|---------|
| `WORK` | `/tmp/nham-flutter` | working-copy dir |
| `API_BASE_URL` | `http://localhost:3000` | backend the app calls |
| `NHAM_ENV_FILE` | auto-discovered | path to a `.env.local` with the Supabase creds |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | from `.env.local` | set to skip the `.env.local` lookup |
| `SIM_UDID` | a booted sim, else auto | target simulator |

## The iCloud codesign caveat

This repo lives under `~/Documents`, which iCloud stamps with a `com.apple.provenance`
extended attribute. `codesign` rejects the Flutter framework with:

```
Flutter.framework/Flutter: resource fork, Finder information, or similar detritus not allowed
```

…**even for a Simulator build.** Clearing the xattr in place doesn't stick (it's re-applied on
copy). The fix is to build from a location iCloud doesn't manage, i.e. `/tmp`. `run_dev.sh` and
the [release lanes](./releasing.md) all build from a `/tmp` mirror for this reason.

## Environment config

Runtime config comes from compile-time `--dart-define`s, read in
[`lib/data/env.dart`](../../mobile-flutter/lib/data/env.dart). Required: `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `API_BASE_URL` (defaults to `http://localhost:3000`). Optional:
`POSTHOG_KEY`, `POSTHOG_HOST`.

| Environment | API_BASE_URL | Supabase |
|-------------|--------------|----------|
| **dev** (sim) | `http://localhost:3000` | dev project (`jqgmcnlfxzzhrvrzpoye…`) |
| **prod** (TestFlight) | `https://nham-internal-…run.app` | prod project (`oudpzhfzirgjbhrzcett…`) |

The dev values live in your `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); prod values are baked into the [release lane](./releasing.md).
These are all client-public values (the Supabase key is a publishable key).

## Backend

The app calls the `/api/v1` REST + SSE surface. Without it running you'll see
"Unable to load today's meals" (the app still boots and auth still works). Start the Next.js
dev server on `localhost:3000` from the worktree that carries `/api/v1`
(the `feat/api-v1-mobile-backend` / RN branch):

```bash
bun run dev
```

On a **physical device** (not the sim) point `API_BASE_URL` at your machine's LAN IP, e.g.
`http://192.168.1.20:3000`. The Info.plist already allows local cleartext via
`NSAllowsLocalNetworking`.

## Gotchas

### Gotcha: CocoaPods breaks after a Ruby bump

Installing other Homebrew tools (e.g. `brew install fastlane`) can bump Homebrew Ruby and
orphan CocoaPods' native `ffi` gem:

```
CocoaPods is installed but broken. Skipping pod install.
```

Fix:

```bash
brew reinstall cocoapods
```

Let **Flutter** drive `pod install` (it runs it as part of the build) rather than calling
`pod` directly.

### Stale `Generated.xcconfig`

`ios/Flutter/Generated.xcconfig` is generated per build and is gitignored. If you copy the app
around, an old one can point `FLUTTER_APPLICATION_PATH` at the wrong directory or carry stale
`--dart-define`s. `flutter clean` + a fresh `flutter build`/`flutter run` regenerates it.
`run_dev.sh` excludes the ephemeral build dirs when mirroring to avoid this.
