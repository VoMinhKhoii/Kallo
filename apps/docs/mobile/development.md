# Mobile — Development

How to run and iterate on the **Flutter** app (`apps/mobile-flutter`) locally.

## Prerequisites

- **Flutter** 3.44+ (`flutter --version`) and the iOS toolchain (`flutter doctor`)
- **Xcode** 26+ with an iOS Simulator runtime installed
- **CocoaPods** (installed; see [the CocoaPods gotcha](#gotcha-cocoapods-breaks-after-a-ruby-bump))
- The **`/api/v1` backend** running locally if you want real data (see [Backend](#backend))

## Quick start

**One command for the whole stack** (backend **+** app), from the repo root:

```bash
bun dev:mobile
```

This starts the `/api/v1` backend on `:3000` (skipped if already up), waits for it to answer, then runs the app on the simulator. **Ctrl-C tears down both.** It's just an orchestrator around `bun run dev` + `tool/run_dev.sh`.

**App only** (when the backend is already running, or you don't need data):

```bash
cd apps/mobile-flutter
./tool/run_dev.sh
```

`tool/run_dev.sh` does everything for the app:

1. Mirrors the app to `/tmp/kallo-flutter` (out of iCloud — see below).
2. Boots / reuses an iOS Simulator.
3. Reads dev Supabase creds from a `.env.local` (the repo root, or a sibling worktree).
4. Runs `flutter run` with the **dev** `--dart-define`s (localhost API + dev Supabase).

Then use the live keys in that terminal: **`r`** hot reload · **`R`** hot restart · **`q`** quit.

### Editing during a session

The app runs from `/tmp/kallo-flutter`, so hot reload watches **that** copy. Edit files there while iterating, then sync your changes back into the repo before committing:

```bash
./tool/run_dev.sh back        # rsync /tmp/kallo-flutter -> apps/mobile-flutter
git status                    # review, then commit
```

(If you prefer editing in the repo, re-run `./tool/run_dev.sh` to re-mirror and cold-start.)

### Overrides

`run_dev.sh` honours these env vars:

| Var | Default | Purpose |
|-----|---------|---------|
| `WORK` | `/tmp/kallo-flutter` | working-copy dir |
| `API_BASE_URL` | `http://localhost:3000` | backend the app calls |
| `NHAM_ENV_FILE` | auto-discovered | path to a `.env.local` with the Supabase creds |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | from `.env.local` | set to skip the `.env.local` lookup |
| `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` | from `.env.local`, else empty | native Google sign-in client IDs (empty ⇒ Google button disabled, app still boots) |
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
`POSTHOG_KEY`, `POSTHOG_HOST`, `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` (native
Google sign-in — empty disables the Google button without blocking startup), and
`REVENUECAT_APPLE_API_KEY` / `REVENUECAT_GOOGLE_API_KEY` (RevenueCat public SDK keys for
in-app subscriptions — the platform key is picked per-OS in
[`lib/data/billing/purchases_service.dart`](../../mobile-flutter/lib/data/billing/purchases_service.dart);
release-capable keys must use the matching `appl_` / `goog_` prefix, while
`test_` is accepted only in debug builds; secret-looking or wrong-platform keys
are rejected before SDK configuration. When the current platform's key is empty the purchases service reports
`purchasesAvailable = false` and the paywall renders a graceful "unavailable" state, so a
dev build without RevenueCat config still boots).

> **Native Google sign-in setup.** `GOOGLE_WEB_CLIENT_ID` is the Google Cloud **Web**
> OAuth client ID (passed to `google_sign_in` as `serverClientId`); it must also be added
> to the Supabase Google provider's **Authorized Client IDs** (for *both* dev and prod
> projects). `GOOGLE_IOS_CLIENT_ID` is the **iOS** client ID; its reversed form
> (`com.googleusercontent.apps.…`) must be set as a URL scheme in
> [`ios/Runner/Info.plist`](../../mobile-flutter/ios/Runner/Info.plist). Android needs the
> debug **SHA-1** registered on an Android OAuth client (package `com.nham.kallo_mobile`);
> no Firebase / `google-services.json`.

| Environment | API_BASE_URL | Supabase |
|-------------|--------------|----------|
| **dev** (sim) | `http://localhost:3000` | dev project (`jqgmcnlfxzzhrvrzpoye…`) |
| **prod** (TestFlight/App Store) | `https://kallo.fit` | `https://kallo.fit/api/supabase-proxy` (proxied to the prod project `oudpzhfzirgjbhrzcett…`) |

Prod auth rides the Cloud Run host's `/api/supabase-proxy` route instead of
`supabase.co` directly, because some VN ISPs blackhole the Supabase Cloudflare
edge (the anon key is unchanged; only the URL differs). Dev still talks to the
dev project directly. To exercise the proxy locally, run the Next.js dev server
and point the app at it:

```sh
SUPABASE_URL=http://localhost:3000/api/supabase-proxy \
SUPABASE_ANON_KEY=<dev publishable key> ./tool/run_dev.sh
```

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

### Gotcha: blank white/black screen on the simulator

The app launches, `flutter:` logs stream (Supabase init, localization), the process is alive — but the screen is **blank**. Two distinct causes, both bit us hard once:

1. **`flutter run` detached.** A **debug** build only renders while `flutter run` is attached. It quits on stdin EOF and detaches the engine → blank window. This happens whenever the app is launched **without an attached `flutter run`**:
   - cold-launching the installed app with `xcrun simctl launch …` after `flutter run` exited, or
   - running `run_dev.sh` / `flutter run` **headlessly** (an agent, CI, `… &`, a pipe) where stdin is closed.

   **Fix:** keep `flutter run` attached. `run_dev.sh` now auto-detects a non-TTY stdin and holds it open so it stays attached; interactively, just leave the `flutter run` terminal running. Never verify via `simctl launch` alone — screenshot the **attached** session.

2. **A native plugin not migrated to the UIScene lifecycle.** This app's iOS shell uses Flutter's new scene template (`ios/Runner/SceneDelegate.swift` = `FlutterSceneDelegate`, implicit-engine `AppDelegate`). A plugin that still uses the old `UIApplicationDelegate` launch lifecycle can break the Flutter view's compositing → blank app even while attached, with a log line like `Plugin FLT…Plugin uses deprecated application lifecycle events … UIScene lifecycle support`. We hit this historically with an **older `google_sign_in`** when it was unused. Native Google sign-in is now back on **`google_sign_in` v7** (`google_sign_in_ios` 6.3.0), which **does** support the UIScene lifecycle — it renders fine here. The lesson still stands: **don't add a native iOS plugin without confirming it supports the UIScene lifecycle**, or you'll get a blank screen.

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
