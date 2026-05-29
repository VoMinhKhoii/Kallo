# Plan: Full 1:1 React Native + Expo Port of Nhẩm (UI + Logic Parity)

> **Status**: Verified, executable. Supersedes the 2026-05-16 draft.
> **Last updated**: 2026-05-29
> **Scope decision**: FULL 1:1 PARITY (UI + logic) of all in-app surfaces — NOT an MVP-first cut. Admin is the only out-of-scope surface.
> **Grounded in**: a fresh 8-mapper verification pass over the live codebase (workflow `map-web-for-rn-port`, 2026-05-29). All line numbers below are current as of that pass.

---

## 1. Plan accuracy report

The original thesis is **sound and survives verification**: actions are pure async functions, the only Next coupling in the auth path is `lib/supabase/server.ts` reading cookies, and the "import a `'use server'` fn as a plain async fn into a route handler" trick works for the entire inventory. But the original draft had accumulated material drift.

### 1.1 The Phase 1 invariant STILL HOLDS — confirmed

- **Zero `revalidatePath` anywhere** in `lib/` (0 occurrences).
- **`redirect(`** appears only in `lib/supabase/middleware.ts:51` (`NextResponse.redirect`, middleware not action) and `lib/admin/require-admin.ts:2` (`notFound()`, admin — excluded).
- **`next/headers`** is imported only by `lib/supabase/server.ts:2` (`cookies`) — the exact file Step 1.1 targets.
- All 19 action exports are pure async functions with no Next side effects. **The import-as-plain-async-fn mechanism is valid for every endpoint.** Phase 1 is not blocked.
- `lib/supabase/server.ts:4-33` is NOT yet Bearer-aware; the ~15-line sketch is accurate. Env vars confirmed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `requireAuthAndProfile(deps?)` dep-injection at `lib/auth.ts:19-43` confirmed — Bearer flows through automatically once Step 1.1 lands.

### 1.2 Drifted line numbers (files grew)

| Action | Old draft | ACTUAL |
|---|---|---|
| `confirmAndSaveMealAction` | meals.ts:112 | **meals.ts:118** |
| `loadMealsByDate` | meals.ts:327 | **meals.ts:357** |
| `loadPendingAnalysesByDate` | meals.ts:427 | **meals.ts:457** |
| `loadLoggingDay` | meals.ts:469 | **meals.ts:499** |
| `deleteMealAction` | meals.ts:537 | **meals.ts:567** |
| `loadMealDates` | meals.ts:560 | **meals.ts:590** |
| `analyzeMealAction` | ai/actions.ts:26 | **ai/actions.ts:30** (dead — see below) |
| analyze-meal rate-limit i18n | route.ts:180-187 | **route.ts:187-194** |
| analyze-meal route span | route.ts:139-381 | **route.ts:146-388** (389-line file) |

`dashboard.ts:57-244` and `weight.ts:54-221` are still accurate.

### 1.3 Substantive correctness errors corrected

1. **`analyzeMealAction` is DEAD CODE** (`lib/ai/actions.ts:30`) — never imported. The SSE route calls `analyzeMeal` from `lib/ai/pipeline` directly and inlines its own auth/validation/rate-limit/persist logic. Mobile must hit the **route**, not this action. Drop the inventory row mapping.
2. **Error-envelope contract mismatch.** `serializeError` (`lib/errors.ts:44`) emits `{ error: { code, status, retryable, message } }`. The old `asApiError` read `body.message` — there is no top-level `message`; it's at `body.error.message`. Mobile must mirror `parseApiError` (`lib/errors.ts:135`). Otherwise every 4xx surfaces as "HTTP 400".
3. **Onboarding actions take positional/unvalidated args.** `saveOnboardingScreen(step, data)` is positional (`onboarding/actions.ts:29`); `saveProfileSettings(data)` is a single untyped arg with zero internal validation (`:95`). The clean `schema.parse(body); action(body)` template does NOT apply. Contracts for these must be **authored from scratch**, and the goal-schema divergence (`settings/profile/index.tsx:40-44` `profileGoalSchema` vs `lib/onboarding/schemas.ts` `goalSchema` — no `deficitOverride`, no superRefine) reconciled first.
4. **Onboarding actions use a different auth path** — private `getAuthUser()` (`onboarding/actions.ts:10`) throws plain `new Error('Not authenticated')`, becoming a **500** through `serializeError`, not a 401. Align to `Errors.notAuthenticated()` when building the routes.
5. **`loadVerdictAction` (`dashboard.ts:112`) is dead on the frontend** — zero consumers; internally calls `loadWeightSummaryAction` so it runs `requireAuthAndProfile()` twice. **Drop `/api/v1/dashboard/verdict`.**
6. **`useDeleteMeal` is dead AND buggy** (`hooks/use-meal-mutations.ts:165`) — optimistic update keyed on `dailyMealsKeys.byDate(today)` while the live screen stores `LoggingDayData` under `loggingDayKeys`. Mobile needs a **corrected** delete hook keyed on `loggingDayKeys`, not a verbatim port.
7. **The "confirm sheet" does not exist.** No sheet/modal/dialog in `components/logging/`. Confirm + per-item gram editing is **inline** in `MealEntry` (`components/logging/feed/meal-entry.tsx`): `isEditing`/`isCollapsed` state, +/- steppers, `onConfirm(edits)`. Do not introduce a bottom sheet "to match web."
8. **Onboarding is a MODAL, not a route.** `app/[locale]/(app)/onboarding/page.tsx` redirects to `/logging`; the wizard is `WizardShell`, conditionally rendered by `AppShell` (`app-shell.tsx:140-147`). Same for `/settings` → `/settings/profile`.
9. **No `tailwind.config.ts` exists.** Web is Tailwind v4 CSS-first; all tokens live in `app/globals.css`. Tokens must be **transcribed** into a NativeWind `tailwind.config.js`, not imported.
10. **Dark mode is dormant on web** — `next-themes` is a dep but no `ThemeProvider` is mounted; `<html>` never gets `.dark`. Ship **light-only** for 1:1 parity.
11. **No `components/weight/*` directory.** Weight UI lives under `components/dashboard/`: `current/compact-weight-log.tsx`, `progress/{progress-story,weight-chart,weight-chart-tooltip,weight-chart-utils}.tsx`, plus `hooks/use-weight-{summary,mutations}.ts`.
12. **Heatmap is NOT Recharts and NOT 30/90-only.** Adherence heatmap is a CSS-grid of `motion.button` cells + Radix tooltips. The ONLY Recharts chart is the weight `AreaChart`. `HeatmapRange` is `'30d'|'90d'|'year'` (`lib/types/dashboard.ts:5`); weight chart range stays `'30d'|'90d'` only — not interchangeable.
13. **`lib/ai/streaming` is a directory**, not `streaming.ts`. Import `@/lib/ai/streaming` (barrel) or `@/lib/ai/streaming/types`.
14. **Incomplete query-key inventory.** Beyond `loggingDayKeys`/`dailyMealsKeys`/`['meal-dates']`, five INLINE keys live in components: `['meal-dates', userId, tz]` (`logging-shell.tsx:64`), `['dashboard','heatmapData',range]` (`use-dashboard-queries.ts:43`), `['nutrition','overview',range,tz??'utc']` (`nutrition-shell.tsx:32`), `['nutrition','candidates',nutrient]` (`food-chip-row.tsx:40`), `['weight-summary',range]`. A faithful port must reproduce these exact keys.
15. **SSE wrapper sketch is wrong.** The server emits **named** SSE events; `react-native-sse` routes named events to named listeners, so a generic `addEventListener('message')` receives nothing. Enumerate each event name. Also web sends `{message, loggedDate, timezoneOffset}` with NO `locale` (`use-feed-submit.ts:81`) — mobile SHOULD send `locale` so per-request rate-limit i18n works.

---

## 2. Scope delta for full 1:1 parity

### 2.1 What changes vs an MVP-first cut
- All five in-app surfaces ship. Phases 4 and 5 are **mandatory**, not optional follow-ups.
- Motion is **pervasive and load-bearing** (streaming waterfall, card mount/exit, collapse/expand, macro-bar fill). Reanimated work is part of each screen phase, not deferred to Phase 6. Reduced-motion accessibility gate respected.
- Light-only is the parity target; the dark-mode toggle is explicitly NOT built.

### 2.2 Complete screen inventory (must ship)

| # | Surface | Web route | In scope |
|---|---|---|---|
| 1 | Landing / Auth | `/{locale}` (public) + `AuthDialog` modal | YES — re-modeled as a sign-in screen (no `/sign-in` route exists on web) |
| 2 | Logging (wedge) | `/{locale}/logging` | YES |
| 3 | Dashboard (Today + Progress/weight + Consistency heatmap) | `/{locale}/dashboard` | YES |
| 4 | Nutrition (editorial report) | `/{locale}/nutrition` | YES |
| 5 | Settings → Profile | `/{locale}/settings` → `/settings/profile` | YES |
| 6 | Onboarding wizard (3-step) | MODAL (not a route) | YES — presented modal gated by profile state |
| — | OnboardingNudge (server-persisted) | sidebar/mobile-nav | YES |
| — | Admin (5 pages) | `/{locale}/(app)/admin/**` | **OUT OF SCOPE** |

Do not port the orphaned localStorage nudge trio (`nudge-dialog.tsx`, `onboarding-card.tsx`, `onboarding-prompt.tsx`) — hardcoded Vietnamese, no live consumers. Port only `OnboardingNudge` (driven by `minimize`/`restoreOnboardingNudge`).

### 2.3 Complete endpoint inventory (reconciled against verified actions)

**Logging (1a):**
| Endpoint | Method | Action | Notes |
|---|---|---|---|
| `/api/v1/meals/confirm` | POST | `confirmAndSaveMealAction` (meals.ts:118) | body `{analysisId, mealId?, edits?}` |
| `/api/v1/logging/day?date&tz` | GET | `loadLoggingDay` (meals.ts:499) | returns `LoggingDayData` |
| `/api/v1/meals?date&tz` | GET | `loadMealsByDate` (meals.ts:357) | |
| `/api/v1/meals/pending?date&tz` | GET | `loadPendingAnalysesByDate` (meals.ts:457) | |
| `/api/v1/meals/:mealId` | DELETE | `deleteMealAction` (meals.ts:567) | |
| `/api/v1/meals/dates?tz` | GET | `loadMealDates` (meals.ts:590) | |
| `/api/analyze-meal` (SSE) | POST | route only (NOT an action) | Step 1.5 i18n change |

**Dashboard + weight (1b):**
| Endpoint | Method | Action | Notes |
|---|---|---|---|
| `/api/v1/dashboard/heatmap?range&tz` | GET | `loadCalorieAdherenceHeatmap` (dashboard.ts:57) | range `'30d'|'90d'|'year'` |
| `/api/v1/weight` | POST | `logWeightAction` (weight.ts:54) | |
| `/api/v1/weight/:loggedDate` | DELETE | `deleteWeightLogAction` (weight.ts:104) | |
| `/api/v1/weight/summary?range&tz` | GET | `loadWeightSummaryAction` (weight.ts:147) | range `'30d'|'90d'` ONLY |
| ~~`/api/v1/dashboard/verdict`~~ | — | `loadVerdictAction` | **REMOVED** — dead, double auth round-trip |

**Onboarding + settings (1c):**
| Endpoint | Method | Action | Notes |
|---|---|---|---|
| `/api/v1/onboarding/profile` | GET | `getOnboardingProfile` (onboarding/actions.ts:19) | no args; private `getAuthUser()` |
| `/api/v1/onboarding/screen` | POST | `saveOnboardingScreen` (29) | **positional `(step, data)`** — author contract from scratch |
| `/api/v1/profile` | PUT | `saveProfileSettings` (95) | **untyped single arg** — author contract; reconcile goal-schema divergence |
| `/api/v1/onboarding/nudge/minimize` | POST | `minimizeOnboardingNudge` (139) | |
| `/api/v1/onboarding/nudge/restore` | POST | `restoreOnboardingNudge` (158) | |

**Nutrition (1d):**
| Endpoint | Method | Action | Notes |
|---|---|---|---|
| `/api/v1/nutrition/overview?range&tz` | GET | `getNutritionOverview` (overview/index.ts:50) | `input:unknown`, self-validates; range `'auto'|'7d'|'30d'|'90d'`; nutrition-local nullable `timezoneOffsetSchema` |
| `/api/v1/nutrition/candidates` | POST | `getFoodSourceCandidates` (candidates.ts:7) | `{nutrient}`; lazy per-nutrient on detail expand |

**Total new route handlers: 16** (verdict removed). All `/api/v1/*` are greenfield (`app/api` currently has only `analyze-meal`, `analyze-meal/debug`, `healthz`).

### 2.4 Web features that cannot be 1:1 — closest mobile-native equivalents

| Web feature | Why not 1:1 | Mobile-native equivalent |
|---|---|---|
| Left-drawer primary nav (`mobile-nav.tsx` Sheet) | RN is bottom-tab-idiomatic | Bottom tabs from `nav-items.ts` order (Dashboard, Nutrition, Logging); Settings + sign-out on a Settings stack |
| URL-locale prefix `/{locale}/...` | No URL on mobile | i18next holds active locale in-process; paths collapse to bare (`/logging`) |
| `#app-mobile-header-slot` DOM portal | No DOM portals | Render the date strip inline in the screen header |
| `createPortal` + `getBoundingClientRect` flip dropdowns (4 bespoke impls) | No portals/measure-to-flip | ONE shared `@gorhom/bottom-sheet` (or Modal+FlatList) picker with search |
| `MotionConfig`/`AnimatePresence mode="wait"` | No exact equivalent | Reanimated `entering`/`exiting`; small state machine for true wait-for-exit |
| Recharts weight `AreaChart` + hover tooltip | Web-only; no hover on touch | `react-native-svg` Path (d3-shape monotone) or victory-native; tooltip → tap |
| `.noise-bg` (mix-blend) | No `mix-blend-mode` in RN | Low-opacity Image overlay or skip |
| SVG `vector-effect: non-scaling-stroke` (calorie ring) | Unsupported by react-native-svg | Pass explicit `strokeWidth` |
| `requestIdleCallback` prefetch | Not in RN | `InteractionManager.runAfterInteractions` |
| `document.visibilitychange` / `window.focus` refresh | No DOM events | `AppState` 'active' listener + midnight `setTimeout` |
| `crypto.randomUUID()` (idempotency key) | Not in RN by default | `expo-crypto.randomUUID()` |
| step-one-locale-draft (sessionStorage across full-page nav) | RN switches locale in-process | **Delete entirely** — web-specific |

---

## 3. Refined phase breakdown

Keeps the right calls: **REST-surface-first, no shared RN components, no monorepo yet (two package.jsons + tsconfig path aliases), REST not tRPC, no new `'use server'` actions during the port, no Supabase mocks in REST-layer tests.**

### Phase 1 — REST surface (~6–8 working days, web-only)
**Goal:** Every in-scope action callable over HTTP with Bearer auth; web unchanged.

Create/touch:
- `lib/supabase/server.ts:4-33` — Bearer-aware `createClient()` (read `Authorization` first, fall back to cookies).
- `lib/api/contracts/{meals,dashboard,weight,onboarding,nutrition,analyze,common}.ts` — request/response Zod. Re-export `mealMessageSchema`/`weightLogSchema`/`dateStringSchema`/`timezoneOffsetSchema` from `lib/validation.ts`; **author onboarding + profile request schemas from scratch** (reconcile `goalSchema` vs `profileGoalSchema`); re-export nutrition's local nullable `timezoneOffsetSchema` from `lib/nutrition/schemas.ts`.
- 16 route handlers under `app/api/v1/**`. Onboarding screen handler destructures `{step,data}` → `saveOnboardingScreen(step, data)`. Align `getAuthUser()` onboarding errors to `Errors.notAuthenticated()`.
- ~~`app/api/analyze-meal/route.ts` Step 1.5 i18n change~~ — **DEFERRED / not required** (decision 2026-05-29). The route already returns the structured envelope with `code: 'RATE_LIMITED'` AND already translates the message to the request `locale` (route.ts:187-190). The mobile SSE client sends `locale` and can also localize from `code`, so it gets correct messages with zero route changes. Doing the refactor would force a web-side rate-limit-toast change (`use-stream-analysis.ts:147-152`) with regression risk and no Phase-1 benefit. Optional future cleanup: make all API errors code-only and localize client-side everywhere.

**Done when:** every endpoint returns expected JSON for a curl with a real JWT; web has zero regressions (`bun test` + `biome check` green; manual log/confirm/dashboard/weight/profile smoke unchanged); a CI contract test asserts each `lib/api/contracts/*` response schema matches a live `/api/v1/*` shape.

> **STATUS — Phase 1 COMPLETE & VERIFIED (2026-05-29), branch `feat/mobile-rn-expo`.**
> - `lib/supabase/server.ts` Bearer-aware ✓ · `lib/api/respond.ts` (Zod→400 helper) ✓ · 7 contract files (`lib/api/contracts/*`) ✓ · 17 route handlers (`app/api/v1/**`) ✓ · `lib/onboarding/actions.ts` `getAuthUser`→`Errors.notAuthenticated()` (401) ✓.
> - Step 1.5 deferred (see note above). Contracts are mobile-safe (no `server-only`/db value imports — verified).
> - Verification: `tsc --noEmit` clean · Biome clean · full `vitest` suite **1292 pass / 17 skip / 0 fail** · live runtime smoke on `:3010` — every endpoint mounts; no-auth→401, bad-input→400, envelope = `{error:{code,status,retryable,message}}`.
> - REMAINING for full Phase-1 sign-off: (a) authed 200-path curl with a real JWT (success bodies); (b) optional CI contract test (response-schema ⇄ live shape). Both are follow-ups, not blockers for Phase 2.

### Phase 2 — Mobile scaffold + auth (~5 days)
**Goal:** Expo app boots, signs in, calls one authed endpoint.

Create:
- `apps/mobile/` via `bunx create-expo-app@latest apps/mobile --template tabs --no-install` (SDK 52+, expo-router v4). Two independent package.jsons; no workspaces.
- `apps/mobile/tsconfig.json` with `@/lib/*` → `../../lib/*`, `@/messages/*`, `@/i18n/*`.
- `apps/mobile/lib/supabase.ts` — `expo-secure-store` adapter, `detectSessionInUrl:false`.
- `apps/mobile/lib/api-client.ts` — `apiGet/apiPost/apiPut/apiDelete`; **`asApiError` reads `body.error.message`** (mirror `parseApiError`), handles `RATE_LIMITED` + `Retry-After`.
- `apps/mobile/app/(auth)/sign-in.tsx` + `auth-callback.tsx` (deep link `nham://auth-callback`); `app.json` `scheme:'nham'`; add redirect to Supabase allowed URLs.
- Root `_layout.tsx` (QueryClientProvider `staleTime:60_000`, i18next, Toaster, SafeAreaProvider, session listener), `index.tsx` (session-gated), `(auth)/_layout.tsx`, `(app)/_layout.tsx` (auth guard + onboarding gating).

**Done when:** sign-in → `apiGet('/api/v1/onboarding/profile')` renders profile. Bail-out: ship magic-link only if PKCE Google fails after 2 dev days.

> **STATUS — Phase 2 code COMPLETE & build-verified (2026-05-29), uncommitted.** Scaffolded with **Expo SDK 56** (RN 0.85, React 19.2.3 — matches web, expo-router v4, Reanimated 4), NOT SDK 52.
> - **Auth methods corrected**: web uses **email/password (`signInWithPassword` + `signUp`) + Google OAuth** — NOT magic-link. Mobile mirrors this: `(auth)/sign-in.tsx` (password + Google PKCE via `expo-web-browser` + `exchangeCodeForSession`), `(auth)/sign-up.tsx`. No separate `auth-callback` route needed — `openAuthSessionAsync` returns the redirect URL inline.
> - **Alias convention**: mobile's own code uses `~/*` → `./src/*`; **`@/lib/*` is reserved for the shared web lib** (`../../lib/*`) so shared files' internal `@/lib/...` imports resolve. `metro.config.js` adds `watchFolders`/`nodeModulesPaths` for the repo root (manual, since we're deliberately not a Bun workspace).
> - Files: `metro.config.js`, `tsconfig.json` (aliases), `app.json` (scheme `nham`, `expo-web-browser` plugin, `typedRoutes:false`, light-only), `.env`(gitignored)/`.env.example`, `src/lib/{supabase,api-client,query-client,session}.ts(x)`, `src/app/_layout.tsx` + `index.tsx` (session gate) + `(auth)/*` + `(app)/*`. Removed template scaffolding.
> - Deps (expo install): `@supabase/supabase-js@2.106`, `@tanstack/react-query@5.100`, `zod@4.4.3` (matches web), `expo-secure-store@56.0.4`, `react-native-url-polyfill`.
> - Verified: `tsc --noEmit` clean · `expo-doctor` 21/21 · **`expo export` bundles (1632 modules → Hermes bundle, 0 errors)**.
> - REMAINING (needs a device/simulator + Supabase dashboard): (a) runtime sign-in (email/password) with a test user; (b) Google OAuth deep link — needs a dev build for the `nham://` scheme + `nham://auth-callback` added to Supabase allowed redirects; (c) authed call to `localhost:3000` (web dev server running + device reachability); (d) the shared `@/lib/*` Metro path is configured but not yet exercised at runtime (first used in Phase 3). SecureStore >2KB caveat noted in `supabase.ts`.

### Phase 3 — Design system + Logging wedge (~7 days)
**Goal:** Full logging parity — type → streaming SSE → inline edit/confirm → feed, with the streaming/confirm animations.

Create:
- NativeWind v4 config (§5) + fonts via `expo-font`.
- `apps/mobile/lib/use-stream-analysis.ts` — `react-native-sse`, **enumerate event names** (`stage`/`item_name`/`item_macros`/`result`/`analysis_complete`/`error`), `pollingInterval:0`, Bearer header, send `locale`. Keep `processEvent` reducer + `requestIdRef`/`AbortController` + `item_macros` upsert-by-`mealItemId`. Parse pre-stream non-200 via `parseApiError`.
- `apps/mobile/app/(app)/(tabs)/logging.tsx` + re-implemented `FeedArea`/`MealInput`/`MealEntry`/`MealEntryItem`/`StreamingMealEntry`/`PersistedMealCard`/`MacroSummary`/`CalorieRing` (RN). FlatList feed + KeyboardAvoidingView footer input. Accept `?meal` param for FAB handoff.
- RN hooks: `useLoggingDay`, `useConfirmMeal` (keep full `originDate`-keyed optimistic machinery), `useFeedSubmit`, `useStreamingTerminalEffects`, `useSubmitGuard`, `usePrefetchDates`. Corrected `useDeleteMeal` keyed on `loggingDayKeys`. Polyfill `crypto.randomUUID` via expo-crypto.
- Preserve the inline `feed-area.tsx:301` post-stream invalidation (`loggingDayKeys.byUserDate` prefix + `['meal-dates']`).

**Done when:** mobile log/confirm/edit-grams/delete round-trips with web on the same backend; streaming waterfall + card mount/exit animate.

### Phase 4 — Dashboard + weight (~6 days)
`(app)/(tabs)/dashboard.tsx`:
- `react-native-svg` adherence heatmap (NOT Recharts) — grid; cell size from `onLayout`; reuse `getHeatmapColor` (CSS vars → hex), `buildCalorieAdherenceHeatmapData`, `chooseRenderedHeatmapRange`; tooltips → press popover.
- Weight chart via react-native-svg/d3-shape or victory-native; reuse `buildXTicks` + Y-domain math verbatim; tooltip → tap.
- `CalorieRing` (animated `strokeDashoffset`), `MacroBars`/`TargetProgressBar`, `CompactWeightLog` (RHF + `weightLogSchema` + `parseDecimalInput`), `FloatingMealTrigger` → cross-tab `router.push`.
- Re-implement `use-dashboard-measurements`, `use-dashboard-date-refresh` (AppState + midnight), `use-dashboard-queries` (preserve `enabled` gating + exact keys/staleTimes).

**Done when:** heatmap renders for ≥7-day user; weight POST+GET roundtrips; midnight/foreground refresh invalidates correctly.

### Phase 5 — Nutrition + Settings/Profile + Onboarding (~8 days)
- `(app)/(tabs)/nutrition.tsx` — editorial sections (EditorialHeader, VerdictHero, DailyRhythm, Focus/Steady/Background, PullQuote, NutrientRow collapsibles, FoodChipRow with lazy `['nutrition','candidates',nutrient]` query). Reuse `helpers.ts`, extract pure `statusKeyFor`. `ListFormat` fallback to `.join(', ')`.
- `(app)/settings/_layout.tsx` (stack) + `index.tsx` (→ profile) + `profile.tsx` — RHF spanning all fields; reconciled goal schema; `SECTION_FOR_FIELD` error-jump; recompute TDEE on save.
- `(app)/onboarding.tsx` — presented modal, gated from `(app)/_layout`. Keep `screenData`-cache + onChange-up + Next-gated-on-valid pattern. Reuse all `lib/onboarding/*` verbatim. **Drop step-one-locale-draft + useLocaleSwitch.**
- Build the shared RN primitive set: Button (cva), thin RN Form bridge, Select/CountryPicker (@gorhom/bottom-sheet), Tabs, Modal, Toast, Slider, DecimalInput (keep comma-decimal logic), OptionStrip/segmented/carb cards.

**Done when:** new user completes onboarding → lands on logging with macros set; profile edits persist; nutrition renders all states.

### Phase 6 — Polish, i18n audit, TestFlight/Play (~5 days)
- i18next audit: `messages/{en,vi}.json` ICU plural/var patterns may need `i18next-icu` (errors namespace is static — clean). Drive `lng` from `expo-localization` + `profile.preferredLocale`, `fallbackLng:'en'`.
- Reanimated polish pass; reduced-motion via `useReducedMotion`.
- **Ship light-only** (no dark toggle — matches web).
- EAS: `eas init`, `build:configure`, `build --profile preview --platform all`, `submit -p ios` (TestFlight) + `submit -p android` (internal).
- Cloud Run cold-start warmup ping on launch.

**Done when:** TestFlight + Play Internal installs complete full sign-in → onboarding → log → dashboard → nutrition → settings on real devices.

---

## 4. Screen-by-screen port matrix

| Web screen / route | expo-router route | Components to re-implement | Hooks to rewrite | Shared lib (verbatim via `@/lib/*`) | Charts / animation |
|---|---|---|---|---|---|
| `/{locale}` + `AuthDialog` | `(auth)/index.tsx`, `(auth)/sign-in.tsx`, `(auth)/auth-callback.tsx` | Sign-in screen, Google btn, email form | supabase auth calls | `i18n/config.ts` | minimal |
| `/{locale}/logging` | `(app)/(tabs)/logging.tsx` | LoggingShell, FeedArea, MealInput, MealEntry(+Item), StreamingMealEntry, PersistedMealCard, MacroSummary, EmptyState, PartialDay notices, MobileTimelinePicker (inline) | useStreamAnalysis (react-native-sse), useFeedSubmit, useStreamingTerminalEffects, useSubmitGuard, useConfirmMeal, useLoggingDay, usePrefetchDates, corrected useDeleteMeal | `ai/streaming/types`+`encoder`, `types/meal`, `meal-utils`, `validation`, `sidebar/timeline-utils`, `format-inline-nutrition`, `streaming-phase-label`, `actions/meals` types, query-key factories | AnimatePresence cards → FadeIn/FadeOut+Layout; streaming stagger → FadeInDown.delay(i*40); collapse → measured-height; CalorieRing strokeDashoffset; macro-bar width |
| `/{locale}/dashboard` | `(app)/(tabs)/dashboard.tsx` | DashboardShell, TodayDock, MealList, AdherenceHeatmap (svg grid), CalorieRing, MacroBars, ProgressStory, CompactWeightLog, WeightChart, meal-trigger FAB | useDashboardQueries, useDashboardMeasurements, useDashboardDateRefresh (AppState), useWeightSummary, useLogWeight/useDeleteWeightLog | `dashboard/adherence`, `dashboard/heatmap-range`, `dashboard/weight-trend`, `weight-chart-utils`, `heatmap-colors` (→hex), `types/dashboard`, `types/weight`, `validation` | Weight AreaChart → react-native-svg/d3 or victory-native (ONLY chart); heatmap cell stagger; ring/bars |
| `/{locale}/nutrition` | `(app)/(tabs)/nutrition.tsx` | NutritionShell, EditorialHeader, VerdictHero, DailyRhythm, Focus/Steady/Background, SpotlightRow, NutrientRow(+Detail), FoodChipRow, TargetProgressBar, CompositionPill, PullQuote, SeedMark empty-state (svg) | inline `['nutrition','overview',...]` query, lazy `['nutrition','candidates',...]` | `nutrition/types`, `primitives/helpers`, extract `statusKeyFor`, nutrition schemas | NutrientRow height expand; section reveals; ListFormat fallback |
| `/{locale}/settings` → `/settings/profile` | `(app)/settings/_layout.tsx`, `index.tsx`, `profile.tsx` | settings Shell (stack), Profile RHF + Tabs, regional/body-metrics/cooking tabs, CountrySelect, OptionStrip | direct `apiPut('/api/v1/profile')` | `onboarding/{tdee,schemas,constants,countries,types}`, reconciled goal schema | sticky save-bar fade; tab swap |
| Onboarding (modal) | `(app)/onboarding.tsx` (`presentation:'modal'`) | WizardShell (screenData cache + onChange-up + Next-gate), ScreenOrigin, ScreenBodyMetrics, ScreenCooking, LanguageToggle, shared Select/CountryPicker | direct `apiPost('/api/v1/onboarding/screen')` | `onboarding/{tdee,schemas,constants,countries,progress,types}`; **drop step-one-locale-draft** | step transitions; drop scroll-gradient |
| OnboardingNudge | `(app)` chrome / tab layout | OnboardingNudge (full↔pill), OnboardingDot | direct `apiPost` minimize/restore | — | pulse-dot withRepeat |

---

## 5. Design-system port spec (1:1)

Source of truth: `app/globals.css` (`@theme inline` + `:root`/`.dark`) and the `nham-design` skill (`.agents/skills/nham-design/`). Visual direction: **Apple Notes on cream paper** — warm, restrained, typography over chrome.

**Transcribe tokens into a NativeWind v4 `tailwind.config.js`** (no web config to import). Convert shadcn OKLCH neutrals to hex; the `nham-*` palette is already hex.

```js
// apps/mobile/tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class', // ship light-only initially (web dark mode is dormant)
  theme: { extend: {
    colors: {
      background:'#ffffff', foreground:'#252525', card:'#ffffff','card-foreground':'#252525',
      popover:'#ffffff','popover-foreground':'#252525', primary:'#343434','primary-foreground':'#fbfbfb',
      secondary:'#f7f7f7','secondary-foreground':'#343434', muted:'#f7f7f7','muted-foreground':'#8e8e8e',
      accent:'#f7f7f7','accent-foreground':'#343434', destructive:'#e1483b',
      border:'#ebebeb', input:'#ebebeb', ring:'#b4b4b4',
      'nham-surface':'#fefbf6','nham-text':'#2c2416','nham-text-muted':'#8b7355',
      'nham-accent':'#c9a87c','nham-border':'#e8d5b5','nham-hover':'#f0eae0',
      'nham-track':'#f5f4f0','nham-stone':'#a8a29e','nham-btn':'#695e4e','nham-btn-hover':'#5a5043',
      'nham-macro-protein':'#c9a87c','nham-macro-carbs':'#8b7355','nham-macro-fat':'#a8a29e',
      'nham-success':'#7ca368','nham-danger':'#d37b69',
      'nham-heatmap-on-target':'#7ca368','nham-heatmap-close':'#a6c495','nham-heatmap-slight':'#d4c9ad',
      'nham-heatmap-moderate':'#e09c84','nham-heatmap-far':'#d37b69','nham-bar-miss':'#d4c9ad',
    },
    borderRadius: { sm:6, md:8, lg:10, xl:14, '2xl':18, '3xl':22, '4xl':26 },
    fontFamily: {
      sans:['Geist'], mono:['GeistMono'], serif:['Fraunces'],
      lora:['Lora'], 'dm-sans':['DMSans'], 'sans-display':['DMSans'],
    },
  }},
  plugins: [],
};
```

**Fonts (via `expo-font`, bundled `.ttf`, register separate weight faces — RN doesn't synthesize weights):** Geist (default body), Geist Mono, **Lora** (big display numerals — calorie ring, dock totals, meal-entry quote; `fontVariant:['tabular-nums']`), **Fraunces** (landing/onboarding hero numerals via `font-serif`), **DM Sans** (UI labels, kcal totals, timestamps). Load at root with `useFonts`; gate render until loaded.

**Must re-implement (no NativeWind equivalent):** `@theme`/`@apply`/`@custom-variant`/`@theme inline` (→ config + className), `.noise-bg` (→ skip/Image), iOS anti-zoom CSS (drop), `tw-animate-css` `animate-in/out` (→ Reanimated entering/exiting), SVG `vector-effect:non-scaling-stroke` (→ explicit strokeWidth), `dvh`/`backdrop-blur`/`::after`/`group-data-[state]` (restyle).

**Animation strategy (react-native-reanimated v3):**
- Define once: `const expoOut = Easing.bezier(0.16,1,0.3,1)`.
- Spring `{stiffness:400,damping:30}` → `withSpring(t,{stiffness:400,damping:30,mass:1})`.
- Tween `{duration:0.9, ease:[0.16,1,0.3,1]}` → `withTiming(t,{duration:900, easing:expoOut})`.
- Calorie ring → `useAnimatedProps` on `Animated.createAnimatedComponent(Circle)`, animate `strokeDashoffset`. Macro bars → width shared value `withDelay(idx*100+200, withTiming(pct,{duration:900,easing:expoOut}))`.
- `AnimatePresence mode="wait"` → state-machine swap; `popLayout` → `LinearTransition`+entering/exiting; `initial={false}` feed → `FadeIn/FadeOut` + `LayoutAnimationConfig skipEntering` on first mount.
- pulse-dot → `withRepeat(withTiming(...),-1,true)`.
- Reduced motion → `useReducedMotion` / `AccessibilityInfo.isReduceMotionEnabled`.

---

## 6. Risks & decisions

### Updated risk register
| Risk | Likelihood | Mitigation | Bail-out |
|---|---|---|---|
| `react-native-sse` named-event routing missed | **High if uncorrected** | Enumerate all event names; `pollingInterval:0` | fetch ReadableStream if Expo runtime supports |
| Mobile error parser reads `body.message` not `body.error.message` | **High if uncorrected** | Mirror `parseApiError`; test 4xx + 429 | — |
| Onboarding endpoints unvalidated/positional + wrong error shape | Medium | Author contracts from scratch; align to `Errors.notAuthenticated()`; reconcile goal schemas | — |
| Bespoke portal dropdowns (4 impls) are the biggest UI rewrite | Medium | Collapse into ONE @gorhom/bottom-sheet picker | Modal+FlatList |
| Motion is load-bearing, not polish | Medium | Reanimated per-screen in Phases 3–5 | Static fallback (last resort) |
| NativeWind lacks Tailwind v4 features for these screens | Medium | Transcribe tokens; restyle specific spots | StyleSheet for problem components |
| AI pipeline churn breaks contract | High | CI contract test: `lib/api/contracts/*` ⇄ live `/api/v1/*` | Freeze pipeline schema during port |
| Supabase PKCE OAuth flaky in RN | Medium | Test in Phase 2 | Ship magic-link only |
| Cloud Run scale-to-zero cold start | Medium | Warmup ping on launch | Cron pre-warm at peak |
| `crypto.randomUUID`/`requestIdleCallback`/Hermes Intl gaps | Low-Med | expo-crypto; InteractionManager; verify Hermes ICU + date-fns fallback | — |
| Type drift via path-alias imports | Medium | Single tsconfig referencing `../../lib/*` — drift surfaces at compile | Move to workspaces if routine |

### Phase 0 decisions — RESOLVED (2026-05-29)
1. **Launch scope** — Full 1:1 parity. Admin stays out of scope.
2. **Platforms** — **iOS + Android** via EAS (one codebase; +~1 day Android UX checks).
3. **Auth UX** — **Mirror web's auth methods 1:1**, fixing any flaws found. Inspect `AuthDialog` (web) in Phase 2 to confirm exactly which methods are enabled (email/OTP, Google OAuth) and replicate; OAuth deep-link is `nham://auth-callback` (add to Supabase allowed redirects if OAuth is in the web set).
4. **API base URL / env** — **Local-first for development.** `EXPO_PUBLIC_API_BASE_URL` → local `bun dev` over LAN IP (or tunnel) during the build; EAS env profiles swap to staging/prod at build time. Gotcha for later: `-eu.a.run.app` is the legacy alias for asia-southeast3 (NOT Europe); Supabase Site URL must match the chosen host to avoid the OAuth/session bug hit on 2026-05-23.
5. **Analytics / observability** — **Sentry + PostHog** (crash reporting + product analytics). Wire in Phase 6; add a privacy-policy note before public launch.

---

## 7. Immediate next actions (ordered, Phase 1)

1. On a worktree at latest main (current: `feat/mobile-rn-expo`).
2. **Step 1.1** — `lib/supabase/server.ts:4-33`: Bearer-aware `createClient()`. Verify: `bun test` green; web cookie login still works; `curl -H "Authorization: Bearer $JWT" /api/healthz` → 200.
3. **Step 1.2** — Create `lib/api/contracts/{common,analyze,meals,dashboard,weight,onboarding,nutrition}.ts`. Re-export from `lib/validation.ts` and `lib/nutrition/schemas.ts`; author `onboardingScreenSchema` (`{step,data}`) + `profileSettingsSchema` from scratch; reconcile `goalSchema` vs `profileGoalSchema`. Derive response schemas from action return types. Verify `bun run typecheck`.
4. **1a (logging, day 1–2):** route handlers `meals/confirm`, `logging/day`, `meals`, `meals/pending`, `meals/:mealId` (DELETE), `meals/dates` (import-as-async-fn + `serializeError`). GET params from `req.nextUrl.searchParams`.
5. ~~**Step 1.5**~~ — DEFERRED (see Phase 1 note). Existing envelope already carries `code` + honors request `locale`; no route change needed for mobile. Web left untouched.
6. **1b (day 3):** `dashboard/heatmap`, `weight`, `weight/:loggedDate` (DELETE), `weight/summary`. Do NOT build `dashboard/verdict`.
7. **1c (day 4):** `onboarding/profile`, `onboarding/screen` (destructure), `profile` (PUT), `onboarding/nudge/{minimize,restore}`. Align onboarding auth errors to `Errors.notAuthenticated()`.
8. **1d (day 5):** `nutrition/overview`, `nutrition/candidates` (POST). Actions self-validate.
9. **Step 1.6 / CI** — `bun test` + `biome check` clean; web smoke unchanged; curl every endpoint with a real JWT (incl. weight POST→GET→DELETE and analyze-meal SSE terminal `analysis_complete`). Add the contract CI test. Ship the Phase 1 PR before Phase 2.
