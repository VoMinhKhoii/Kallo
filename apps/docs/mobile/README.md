# Kallo Mobile — Docs

Documentation for the Kallo mobile client:

| App | Path | Stack | Status |
|-----|------|-------|--------|
| **Flutter** | [`apps/mobile-flutter`](../../mobile-flutter) | Flutter 3.44, Riverpod, go_router, Supabase | 1:1 port of the web mobile view; on TestFlight as `com.khoivo.nham` |

The app talks to the **same** backend (`/api/v1` REST + SSE) and the same Supabase project as the web app.

> An earlier React Native / Expo port (`apps/mobile`) was removed once the Flutter app reached parity.

## Contents

- **[development.md](./development.md)** — run the app locally on the iOS Simulator, the dev loop, env config, gotchas.
- **[releasing.md](./releasing.md)** — build + ship to TestFlight (fastlane, signing, App Store Connect API key, export compliance).
- **[architecture.md](./architecture.md)** — project structure, stack, state/navigation/data layers, web parity.

## TL;DR

```bash
# Whole stack — backend (:3000) + app on the simulator, one command (repo root)
bun dev:mobile

# App only (backend already running, or no data needed)
cd apps/mobile-flutter && ./tool/run_dev.sh

# Ship a TestFlight build (prod backend, auto build-number bump)
cd apps/mobile-flutter/ios && fastlane ios beta
```

> ⚠️ This repo lives under `~/Documents` (iCloud-synced), which breaks iOS codesign
> from inside the working tree. Builds run from a `/tmp` mirror — `run_dev.sh` and the
> fastlane lanes handle this automatically. See [development.md](./development.md#the-icloud-codesign-caveat).
