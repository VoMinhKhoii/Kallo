# Mobile — Releasing to TestFlight

How the **Flutter** app ships to TestFlight. Unlike the earlier RN port (now removed, which used
Expo/EAS cloud builds), the Flutter app is a **local Xcode archive** signed with your own Apple credentials and
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
You need the paid Apple Developer Program (already in place — the earlier RN port shipped to TestFlight).

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

- **Bundle id:** `com.khoivo.nham` — intentionally the **same as the earlier RN port**, so the Flutter
  build appears as a new build of the existing App Store Connect record (App id `6775761392`),
  with the same testers. (The Flutter project's original `com.nham.kalloMobile` was changed for this.)
- **Marketing version:** `1.0.0` (from `pubspec.yaml`'s `version:`). Bump it there when you want a
  new version train.

## Production config

The `beta` lane injects the **prod** backend via `--dart-define` (mirrors the RN EAS "production"
profile — all client-public values):

- `API_BASE_URL=https://kallo.fit` — mobile must traverse Cloudflare; the raw
  `run.app` origin requires a private header the app does not carry.
- `SUPABASE_URL=<API_BASE_URL>/api/supabase-proxy` — auth is proxied through Cloud Run because
  some VN ISPs blackhole the supabase.co Cloudflare edge (prod project stays `oudpzhfzirgjbhrzcett…`)
- `SUPABASE_ANON_KEY=sb_publishable_…`
- `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` — native Google sign-in (baked into the
  Fastfile defaults; the iOS client ID's reversed form is also the URL scheme in
  `ios/Runner/Info.plist`).
- `REVENUECAT_APPLE_API_KEY` — Kallo's client-public RevenueCat iOS SDK key,
  supplied by `KALLO_REVENUECAT_APPLE_API_KEY` for release builds.
  Release builds require the `appl_` prefix and reject RevenueCat secret-key
  prefixes (`sk_` / `atk_`); `test_` keys are only for explicitly configured
  local Test Store builds.

Override via `NHAM_API_BASE_URL`, `NHAM_SUPABASE_URL`, `NHAM_SUPABASE_KEY`,
`NHAM_GOOGLE_WEB_CLIENT_ID`, `NHAM_GOOGLE_IOS_CLIENT_ID`.

> **Deploy order:** the `/api/supabase-proxy` route must be live on the Cloud Run
> service before a build ships, or that build cannot authenticate at all. To cut a
> build against supabase.co directly, set `NHAM_SUPABASE_URL`.

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

`ios/Runner/Info.plist` sets `ITSAppUsesNonExemptEncryption = false` — Kallo uses only standard
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
| `No profiles for 'com.khoivo.nham' were found` | Run `fastlane ios signing` (fetches from match); if the match repo is empty, seed it with `fastlane match appstore`. |
| Build stuck "Missing Compliance" in TestFlight | Pre-flag build; answer the encryption/France prompt once, or ship a new build (flag is set). |
| `latest_testflight_build_number` auth fails | Check the `.p8` path + Key/Issuer IDs; `fastlane ios validate`. |

## CI (GitHub Actions)

`.github/workflows/ios-testflight.yml` runs `fastlane ios beta` on a `macos-15` runner —
**manual trigger only** (Actions tab → "iOS TestFlight" → Run workflow). Signing comes from
[`fastlane match`](https://docs.fastlane.tools/actions/match/): certs + the App Store profile
live **encrypted in a private git repo** and are fetched **read-only** in CI, so a fresh runner
never mints a new certificate (which would burn Apple's cert cap). The `signing` lane uses match;
`ExportOptions.plist` and the lane both reference the match profile name `match AppStore com.khoivo.nham`.

### One-time setup

1. **Create a private "match" repo** (e.g. `VoMinhKhoii/nham-ios-certs`) — empty is fine.
2. **Seed it locally** from the app dir, authenticating with the same ASC API key:
   ```bash
   cd apps/mobile-flutter/ios
   export MATCH_GIT_URL=https://github.com/<you>/nham-ios-certs.git
   export MATCH_PASSWORD=<pick a strong passphrase>   # encrypts the repo
   bundle install
   bundle exec fastlane match appstore                 # creates + stores cert + profile
   ```
   (If you'd rather reuse your existing distribution cert instead of minting a new one, use
   `fastlane match import` — see the match docs.)
3. **Add the GitHub repo secrets** (Settings → Secrets and variables → Actions):

   | Secret | What |
   |--------|------|
   | `ASC_KEY_P8_BASE64` | `base64 -i AuthKey_<KEYID>.p8` (the App Store Connect API key) |
   | `ASC_KEY_ID` / `ASC_ISSUER_ID` | from the API key (public, but kept as secrets for tidiness) |
   | `MATCH_GIT_URL` | HTTPS URL of the private match repo |
   | `MATCH_PASSWORD` | the passphrase from step 2 |
   | `MATCH_GIT_BASIC_AUTHORIZATION` | `base64 "<gh-user>:<PAT-with-repo-scope>"` — lets CI read the match repo |
   | `NHAM_KEYCHAIN_PASSWORD` | any string; password for the ephemeral CI keychain |
   | `KALLO_REVENUECAT_APPLE_API_KEY` | client-public RevenueCat iOS SDK key (`appl_...`) |

   The workflow always creates the `app_store_release` profile against
   `https://kallo.fit`. The retired internal service must not be revived just
   for billing tests. Until a separately approved QA backend exists, test the
   complete sandbox server flow locally (or through a short-lived tunnel);
   TestFlight store transactions are sandbox transactions and production
   entitlement reconciliation intentionally rejects them.

Client-public values (`API_BASE_URL`, `SUPABASE_*`, the Google client IDs, team/app id) are baked
into the `Fastfile` defaults — no secrets needed.

**Local builds after the migration:** `fastlane ios beta` from your machine now also pulls signing
from match, so export `MATCH_GIT_URL` + `MATCH_PASSWORD` first (same as the seed). Outside CI it's
not read-only, so it can refresh the cert/profile if needed. Add them to your shell profile or a
local env file so you don't re-export each time.
