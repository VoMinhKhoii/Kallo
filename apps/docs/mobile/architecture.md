# Mobile — Architecture (Flutter)

A map of the **Flutter** app (`apps/mobile-flutter`, package `nham_mobile`). It's a 1:1 port of
the web app's mobile-responsive view, sharing the same backend and Supabase project.

## Stack

| Concern | Choice |
|---|---|
| UI | Flutter 3.44 (Material), `google_fonts`, `flutter_svg`, `fl_chart` |
| State | `flutter_riverpod` ^2.6 |
| Navigation | `go_router` ^15 |
| Auth + data | `supabase_flutter` ^2.10, `http` ^1.3 |
| Storage | `flutter_secure_storage` ^9.2 |
| i18n | `easy_localization` ^3, `flutter_localizations`, `intl` |
| Google sign-in | Supabase OAuth browser flow (`signInWithOAuth` + `nham://auth-callback` deep link) — no native `google_sign_in` SDK |

## Layout

```
lib/
  main.dart            app entry: env assert, Supabase init, runApp
  app.dart             root widget (theme, localization, router wiring)
  router.dart          go_router routes + redirect/auth seam
  data/
    env.dart           compile-time config (String.fromEnvironment / --dart-define)
    api_client.dart    typed client for the /api/v1 REST + SSE surface
    session_provider.dart  Supabase session as a Riverpod provider
    query.dart         shared fetch/query helpers
    analytics.dart     PostHog wrapper (no-op until keys set)
  services/
    supabase_service.dart   Supabase initialization
  models/              DTOs: meal, nutrition, dashboard, weight, onboarding, streaming
  features/            one folder per surface (see below)
  shared/widgets/      cross-cutting primitives (nham_primitives, nham_text,
                       decimal_input, target_progress_bar, section_eyebrow)
  shell/               app shell: header, sidebar/drawer, tab scaffold
  theme/               nham_colors, nham_typography, nham_theme
```

### Features (one module per surface)

`lib/features/{auth, onboarding, dashboard, logging, nutrition, settings}/` — each typically
splits into `screens/`, `widgets/`, `data/` or `providers/`, and `logic/`:

- **auth** — sign in / sign up, Google button, Supabase auth.
- **onboarding** — 3-step profile (origin, body metrics, cooking) + TDEE calc.
- **dashboard** — calorie-remaining ring, macro bars, adherence heatmap, weight chart, recent meals.
- **logging** — date timeline, calorie ring, streaming meal analysis (SSE), meal input/cards.
- **nutrition** — editorial overview, 7/30/90 toggle, macro composition, nutrient rows.
- **settings** — two-level nav → profile form (body metrics, cooking, regional).

## Cross-cutting design

- **State:** Riverpod providers per feature (`*_providers.dart`); the Supabase session drives
  auth-gated routing. Riverpod controllers wrap streaming (`stream_analysis_controller.dart`).
- **Navigation:** `go_router` with a shell route. The shell is a **left slide-in drawer**
  (hamburger), not a bottom tab bar — matching the web mobile nav.
- **Data:** `api_client.dart` hits `/api/v1`. Note Drizzle decimals serialize as **strings**, and
  targets are **null** for not-fully-onboarded profiles — models tolerate nulls and fall back to
  the same defaults as the web app.
- **Theming:** warm earthy palette on a cream surface (`theme/nham_colors.dart`), Lora serif +
  DM Sans (`theme/nham_typography.dart`) — see the `nham-design` skill for the brand source.

## Web parity

`apps/mobile-flutter/FIDELITY_AUDIT.md` tracks web↔Flutter divergences per surface
(**298 catalogued, 141 applied** at last audit) with `web ↔ Flutter` file:line refs. It's the
source of truth for "does this match the web view." `flutter analyze` is kept clean (0 errors).

## History: the RN app

An earlier React Native / Expo port (`apps/mobile`) was removed once the Flutter app reached
parity. The Flutter app kept that port's bundle id (`com.khoivo.nham`), so it inherits the same
TestFlight record — see [releasing.md](./releasing.md).
