# Releasing on Google Play

The Android app is `fit.kallo.app`. That ID is permanent once the first bundle is
uploaded: Play, RevenueCat and the Android Google OAuth client are all keyed on it.

## One-time setup

**Toolchain.** Gradle 8 needs JDK 17 (JDK 23 fails), and Flutter needs an Android SDK:

```bash
brew install openjdk@17
brew install --cask android-commandlinetools
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-36" "build-tools;36.0.0"
flutter config --android-sdk $ANDROID_HOME \
  --jdk-dir /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

The first build downloads the other platforms, NDK and CMake it needs (about 10 minutes).

**Upload key.** Play App Signing holds the real signing key. We only keep an upload
key, and Google can reset it if it is lost. Keep it out of the repo, in a password manager:

```bash
keytool -genkeypair -keystore ~/.android-keys/kallo-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then create `apps/mobile-flutter/android/key.properties` (gitignored):

```properties
storeFile=/Users/<you>/.android-keys/kallo-upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

Without this file a release build is signed with the debug key, which Play rejects.
`tool/build_android_release.sh` refuses to run without it.

## Build

```bash
cd apps/mobile-flutter
BUILD_NUMBER=6 KALLO_REVENUECAT_GOOGLE_API_KEY=goog_… ./tool/build_android_release.sh
```

The script points the build at the prod backend, using the same client-public values
as `ios/fastlane/Fastfile`. `BUILD_NUMBER` is Play's `versionCode` and must be higher
than the last upload. `KALLO_POSTHOG_KEY` and `KALLO_SENTRY_DSN` are optional.
The output is `build/app/outputs/bundle/release/app-release.aab`.

## Play Console

1. Create the app with package `fit.kallo.app` and turn on Play App Signing (the default).
2. Upload the bundle to **Internal testing** first.
3. A personal developer account created after Nov 2023 must run a **closed test with
   at least 12 testers for 14 days in a row** before it can apply for production.
4. Fill in Data safety (crash data and product interaction, linked to the user, not
   used for tracking; see `docs/MONITORING.md`), the content rating, the target
   audience and the privacy policy URL (`https://kallo.fit/privacy`).

## Google sign-in

Android Google sign-in checks the app's signing certificate. Add an **Android** OAuth
client for `fit.kallo.app` in Google Cloud with **two** SHA-1 fingerprints: the
upload key's (`keytool -list -v -keystore …`) and the **app signing key's** from
Play Console → Test and release → App integrity. Installs from Play are signed with
the second one, so leaving it out breaks sign-in only for Play installs.
