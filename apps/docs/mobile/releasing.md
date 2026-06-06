# Mobile — Releasing to TestFlight

How the **Flutter** app ships to TestFlight. Unlike the RN app (which used Expo/EAS cloud
builds), the Flutter app is a **local Xcode archive** signed with your own Apple credentials and
uploaded via **fastlane**. Everything is committed at `apps/mobile-flutter/ios/fastlane/`.

> First successful ship: **build 1.0.0 (4)**, 2026-06-06.

## At a glance

```bash
cd apps/mobile-flutter/ios
fastlane ios validate   # check API-key auth + print latest TestFlight build number
fastlane ios beta       # build (prod config) + sign + upload to TestFlight
```

`beta` auto-computes the next build number (latest TestFlight build + 1), so you don't manage it
by hand.

## One-time setup

### 1. Apple Developer membership
You need the paid Apple Developer Program (already in place — the RN app shipped to TestFlight).

### 2. App Store Connect API key
Auth is via an App Store Connect **API key** (not interactive Apple login).

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys**.
2. First time: the Account Holder clicks **Request Access** to enable the API.
3. **Generate API Key** with the **App Manager** role (enough for TestFlight).
4. Download the `AuthKey_XXXXXXXXXX.p8` — **downloadable once**.
5. Note the **Key ID**, the **Issuer ID** (top of the page), and your **Team ID**
   (developer.apple.com → Membership).

Place the key where fastlane looks for it (never commit it):

```bash
mkdir -p ~/.appstoreconnect/private_keys
mv ~/Downloads/AuthKey_*.p8 ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
chmod 600 ~/.appstoreconnect/private_keys/*.p8
```

The Key ID / Issuer ID / Team ID are baked into the `Fastfile` (they're useless without the
`.p8`) and can be overridden via `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_TEAM_ID`, `ASC_KEY_FILEPATH`.

## App identity

- **Bundle id:** `com.khoivo.nham` — intentionally the **same as the RN app**, so the Flutter
  build appears as a new build of the existing App Store Connect record (App id `6775761392`),
  with the same testers. (The Flutter project's original `com.nham.nhamMobile` was changed for this.)
- **Marketing version:** `1.0.0` (from `pubspec.yaml`'s `version:`). Bump it there when you want a
  new version train.

## Production config

The `beta` lane injects the **prod** backend via `--dart-define` (mirrors the RN EAS "production"
profile — all client-public values):

- `API_BASE_URL=https://nham-internal-714321235532.asia-southeast3.run.app`
- `SUPABASE_URL=https://oudpzhfzirgjbhrzcett.supabase.co`
- `SUPABASE_ANON_KEY=sb_publishable_…`

Override via `NHAM_API_BASE_URL`, `NHAM_SUPABASE_URL`, `NHAM_SUPABASE_KEY`.

## How signing works (and why it's shaped this way)

The lane does **manual distribution signing scoped to the `Runner` target only**:

1. `cert` + `get_provisioning_profile` (via the API key) create an **Apple Distribution**
   certificate and an **App Store** provisioning profile (`com.khoivo.nham AppStore`) into an
   **isolated keychain** (`nham-ci.keychain-db`) — no GUI prompts.
2. `flutter build ios --release --no-codesign --dart-define=…` compiles Dart with the prod
   defines (the build phase doesn't need a cert this way).
3. `update_code_signing_settings(targets: ["Runner"])` sets manual signing **on Runner only**.
4. `xcodebuild archive` → `xcodebuild -exportArchive` (with `ios/ExportOptions.plist`) →
   `upload_to_testflight`.

Two hard-won reasons it's not simpler:

- **Don't apply a profile globally.** Passing `PROVISIONING_PROFILE_SPECIFIER` as a global
  xcodebuild setting makes every Pod/SwiftPM dependency target fail with
  *"X does not support provisioning profiles."* Scope it to `Runner`.
- **Don't use `-allowProvisioningUpdates` automatic signing here.** It requests an *iOS App
  Development* profile, which needs a registered device (*"your team has no devices"*). Manual
  distribution signing avoids that.

Also: the archive **builds from a `/tmp` mirror** for the same [iCloud codesign reason](./development.md#the-icloud-codesign-caveat) as dev.

## Export compliance

`ios/Runner/Info.plist` sets `ITSAppUsesNonExemptEncryption = false` — Nhẩm uses only standard
HTTPS/TLS (API + Supabase auth), which is exempt. This makes App Store Connect **skip** the
encryption + France export-compliance questionnaire on every build.

> Builds uploaded **before** this flag was added (e.g. the very first 1.0.0 (4)) still prompt
> once in TestFlight — answer **No** to "available in France" to clear that build without
> uploading documentation. New builds won't ask.

## Ship a build, step by step

```bash
cd apps/mobile-flutter/ios
fastlane ios validate          # sanity: auth works, see current build number
fastlane ios beta              # ~5–8 min: build, sign, upload
```

Then in App Store Connect → TestFlight, the build processes for ~5–15 min and becomes available
to your testers.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `resource fork … detritus not allowed` | iCloud xattr; build from `/tmp` (the lanes already do). |
| `CocoaPods is installed but broken` | Ruby bump orphaned `ffi`; `brew reinstall cocoapods`. |
| `X does not support provisioning profiles` | A profile/identity was applied globally; scope signing to the `Runner` target only. |
| `your team has no devices … iOS App Development profile` | Automatic signing chose a dev profile; use manual distribution signing (the `beta` lane does). |
| `No profiles for 'com.khoivo.nham' were found` | Run `fastlane ios signing` to (re)create the cert + App Store profile. |
| Build stuck "Missing Compliance" in TestFlight | Pre-flag build; answer the encryption/France prompt once, or ship a new build (flag is set). |
| `latest_testflight_build_number` auth fails | Check the `.p8` path + Key/Issuer IDs; `fastlane ios validate`. |

## CI (future)

The same lanes run on a macOS CI runner with the `.p8` stored as a secret (base64) and
`ASC_*` / `NHAM_*` as env. fastlane is preinstalled on GitHub-hosted macOS runners. Not wired up
yet — `fastlane ios beta` from a dev machine is the current path.
