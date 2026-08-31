# Mobile — Architecture (Flutter)

A map of the **Flutter** app (`apps/mobile-flutter`, package `kallo_mobile`). It's a 1:1 port of
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
| Google sign-in | Native `google_sign_in` ^7.2 (in-app account picker) → Supabase `signInWithIdToken` — same shape as Apple, no Safari/`nham://auth-callback` round-trip |

## Layout

```
lib/
  main.dart            app entry: env assert, Supabase init, runApp
  app.dart             root widget (theme, localization, router wiring)
  router.dart          go_router routes + redirect/auth seam
  services/            infrastructure edges, one folder per concern:
    http/                api_client.dart, api_client_uploads.dart, query.dart
    auth/                supabase_service.dart, session_provider.dart
    billing/             RevenueCat purchases + entitlement state
    analytics/           PostHog wrapper (no-op until keys set)
    env/                 compile-time config (String.fromEnvironment / --dart-define)
  models/              DTOs grouped by domain: nutrition/ logging/ social/ profile/
  features/            one folder per surface (see below)
  shared/widgets/      cross-cutting primitives, one folder each: avatar/ brand/
                       calorie_ring/ feedback/ form/ motion/ sheet/ surface/
                       toast/ typography/
  shared/logic/        pure functions >1 feature reads: tdee.dart, display_format.dart
  shared/data/         static tables >1 feature reads: countries.dart
  shell/               app shell: header/, nav/ (pill tab bar), tab_scaffold.dart,
                       placeholder_screen.dart
  theme/               kallo_colors, kallo_typography, kallo_theme, calm_tokens
```

There is no `lib/data/`: everything it held was infrastructure and merged into `services/`.
The tree has no barrels — see `apps/mobile-flutter/AGENTS.md` §3 for the rule and the two
shapes it covers.

### Features (one module per surface)

`lib/features/{auth, circle, dashboard, feedback, logging, nutrition, onboarding, paywall,
settings}/` — each typically splits into `screens/`, `widgets/`, `data/` or `providers/`, and
`logic/`:

- **auth** — sign in / sign up, Google button, Supabase auth.
- **onboarding** — 3-step profile (origin, body metrics, cooking) + TDEE calc.
- **dashboard** — calorie-remaining ring, macro bars, adherence heatmap, weight chart, recent meals.
- **logging** — date timeline, calorie ring, streaming meal analysis (SSE), meal input/cards.
  Composer modes: normal (AI), cheat meal (AI slider estimate — intensity strip, clarify
  fallback, "log it again" chips via `/api/v1/meals/cheat-*`), manual, barcode.
  Normal mode also carries **relog**: typing `/` opens a picker of dishes and meals you
  have logged before (`/api/v1/meals/relog/candidates`), and a pick becomes tinted text
  inside the field plus a staged reference. Picks alone stage a deterministic review card
  (`/api/v1/meals/relog/stage`, no AI); picks alongside free text ride the analyze stream
  as `refs` and are merged server-side. Either way the server copies the stored
  `meal_items` rows verbatim — past meals hold goal-adjusted macros that cannot be
  re-derived. Tinting comes from `MentionTextEditingController.buildTextSpan`, not the
  web's mirror-element overlay.
  Portion clarity (`logic/portion/` + `widgets/portion/`): every staged dish the pipeline
  resolved a vessel for carries a `≈ tô vừa` assumption line under it, opening a picker
  sheet — true-to-scale silhouettes from `assets/portions/` riding a **tape measure**:
  the scale scrolls under a fixed accent needle, tall graduations mark each vessel tier,
  and every graduation gives one haptic detent plus a click. The bowl / plate / cup branch
  and the fish / meat / poultry branch share one control (`widgets/portion/ruler/`); only
  the art and the tier labels differ. **The ruler is a deliberate mobile-only divergence**
  — web's plain Radix slider suits a pointer and a keyboard, but on touch there is no
  hover, arrow key or focus ring, so the bar carries none of that affordance. Otherwise a
  port of `components/logging/feed/meal-entry/portion/`; the vessel rides in on the SSE
  `result` frame and on restored `/api/v1/meals/pending` rows.
  **Shared with web — keep them in lockstep.** The tier tables, envelope factors and
  claim band are vendored copies of `lib/ai/portion/data/vessel-tables.ts` and
  `components/logging/feed/meal-entry/portion/portion-anchors.ts`. Drift means the two
  clients commit *different tiers for the same meal* while each stays internally
  consistent, so `test/portion_vessel_assets_test.dart` reads the TypeScript and pins
  every shared number (asset filenames + aspects, `MAX_PIECE_COUNT`, envelope factors,
  `CLAIM_BAND`, `POSITION_MAX`, tier grams/ml). Change a number on one side and that test
  fails. Validation is NOT vendored: `toParsedMeal` (`lib/ai/adapters/parsed-meal.ts`) drops any vessel
  a picker can't safely render, so both clients inherit one guarantee — the Dart parser's
  own checks are defense in depth for rows written before that guard existed.
- **nutrition** — editorial overview, 7/30/90 toggle, macro composition, nutrient rows.
- **settings** — two-level nav → profile form (body metrics, cooking, regional).

## Cross-cutting design

- **State:** Riverpod providers per feature (`*_providers.dart`); the Supabase session drives
  auth-gated routing. Riverpod controllers wrap streaming (`stream_analysis_controller.dart`).
- **Navigation:** `go_router` with a `StatefulShellRoute` behind a **floating pill
  tab bar** (`shell/nav/pill_nav_bar.dart`; the web-parity drawer/hamburger retired in
  the 2026-08-31 native pass). Branches: dashboard, nutrition, circle (+ off-bar
  admin); the bar's center `+` opens the Add sheet (meal / weight). **Log pushes
  full-screen** over the shell as a root `CupertinoPage` (the composer owns its
  bottom edge; swipe-back returns to the previous tab), like `/settings`, which now
  pushes from the dashboard avatar.
- **Motion:** durations and curves are tokens (`theme/kallo_motion.dart`: `KalloMotion`,
  `KalloEase`), named by role. Full rules, and the traps behind them, in `kallo-design/mobile.md`.
- **Dialogs:** one confirmation surface, `shared/widgets/dialog/kallo_confirm.dart`
  (`showKalloConfirm`) — a centred title, a centred muted line, and the two buttons
  **stacked**, affirmative above cancel. It replaced three separate chromes (bare Material
  `AlertDialog`, `CupertinoActionSheet`, and a hand-rolled one). Vietnamese affirmatives
  default to `common.agree` ("Đồng ý") because "huỷ" means both *cancel* and *destroy*, so a
  verb like "Xoá" beside "Huỷ" reads as the same choice twice; a confirm whose verb does not
  collide (e.g. "Rời nhóm") passes its own `confirmLabel`.
- **Sheets:** `showNhamSheet` (`shared/widgets/sheet/kallo_sheet.dart`) + `KalloSheetSurface` +
  `KalloSheetHeader` (`kallo_sheet_header.dart`). `isScrollControlled` defaults to **true** —
  Material's default caps a sheet at 9/16 of the screen and clips the rest, which pushed
  action rows off-screen on short phones and in landscape. A sheet whose body is a plain
  `Column` also passes `scrollable: true` so it caps at 90% height and scrolls past it;
  sheets that own a `ListView`/`SingleChildScrollView` must not. `test/sheet_overflow_test.dart`
  pumps every content-hugging sheet at 320×568, 360×640 and landscape, at 1.0x and the
  1.3x Dynamic Type ceiling, and fails if the primary action can't be reached.
- **Data:** `api_client.dart` hits `/api/v1`. Note Drizzle decimals serialize as **strings**, and
  targets are **null** for not-fully-onboarded profiles — models tolerate nulls and fall back to
  the same defaults as the web app.
- **Theming:** warm earthy palette on a cream surface (`theme/kallo_colors.dart`), Lora serif +
  DM Sans (`theme/kallo_typography.dart`) — see the `kallo-design` skill for the brand source.

## Web parity

`apps/mobile-flutter/FIDELITY_AUDIT.md` tracks web↔Flutter divergences per surface
(**298 catalogued, 141 applied** at last audit) with `web ↔ Flutter` file:line refs. It's the
source of truth for "does this match the web view." `flutter analyze` is kept clean (0 errors).

## History: the RN app

An earlier React Native / Expo port (`apps/mobile`) was removed once the Flutter app reached
parity. The Flutter app kept that port's bundle id (`com.khoivo.nham`), so it inherits the same
TestFlight record — see [releasing.md](./releasing.md).
