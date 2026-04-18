# Onboarding Locale Sync & Cooking Hint Restoration Design

**Date**: 2026-04-18  
**Status**: Approved

## Problem

The current onboarding and locale flow has three connected issues:

1. **Changing language in onboarding does not update the UI immediately.** The onboarding screen stores `preferredLocale` in local wizard state, but it does not switch the active localized route or the `next-intl` runtime locale.
2. **Landing language and onboarding language can drift.** Landing locale is driven by the active `/${locale}` route and locale cookie, while onboarding defaults from `user_profiles.preferred_locale`, which currently defaults to `'en'` for new users and is not used to drive routing.
3. **Screen 3 option descriptions disappeared.** The cooking screen still supports per-option hints and the translation keys still exist, but the hints are no longer passed into the rendered options.

## Research-Grounded Design Principles

This design follows the common `next-intl` / Next.js App Router pattern:

- **The active route locale is the source of truth for the current UI.**
- **The locale cookie persists the browser-level preference.**
- **`user_profiles.preferred_locale` persists the signed-in account preference.**
- **Explicit localized routes win for the current render.** Persisted preferences are bootstrap inputs, not perpetual overrides.

This avoids URL-vs-cookie-vs-DB tug-of-war and matches how prefix-based locale routing is typically handled with `next-intl`.

## Scope

This design covers:

1. locale ownership and synchronization for landing, onboarding, and root bootstrap
2. onboarding step 1 language behavior and draft preservation
3. restoration of cooking option hints on onboarding screen 3
4. tests for the above behavior

This design does **not** add a new global locale system or rewrite the app's i18n architecture.

## Locale Ownership Model

| Scope | Source | Responsibility |
|------|--------|----------------|
| Current render | localized route (`/[locale]/...`) | Determines the language currently shown to the user |
| Browser persistence | locale cookie | Remembers last explicit browser choice |
| Account persistence | `user_profiles.preferred_locale` | Remembers preferred locale for signed-in users across devices |

### Precedence Rules

1. **Explicit route locale wins for the active page.**
2. **A user-triggered language change updates downstream persistence.**
3. **DB preference only bootstraps locale selection when no explicit locale route is already in play.**

Concretely:

- If the user is already on `/en/...` or `/vi/...`, the route locale is canonical for that render.
- A locale switch action should move the user to the matching localized route immediately.
- When the user is authenticated, the same selection should be persisted to `preferred_locale`.
- The app must not silently redirect away from an explicit localized route just because the DB value differs.

## Bootstrap Rules

When the app needs to choose a locale **without** an explicit locale route decision from the user:

1. If the request is for bare `/` and the user is authenticated, use `user_profiles.preferred_locale` when present.
2. Otherwise use the locale cookie.
3. Otherwise use the app default locale.

This gives signed-in users cross-device persistence without making DB state override every localized route visit.

The bootstrap decision point lives in the root entry redirect path (`app/page.tsx`), while the existing locale middleware continues to handle locale-prefixed routing and cookie persistence during normal navigation.

## Concrete Solution

### 1. Shared Locale Switch Path

Landing and onboarding should use the same locale change mechanism:

- resolve the current pathname via locale-aware navigation helpers
- switch locale via `router.replace(pathname, {locale})`
- rely on the existing `next-intl` middleware/cookie behavior instead of maintaining disconnected language-switch logic

This behavior should live behind one explicit abstraction, e.g. a small `useLocaleSwitch` hook or equivalent helper contract, so landing and onboarding share the exact same runtime path.

The goal is one coherent path for locale changes, not one implementation on landing and another inside onboarding.

### 2. Onboarding Step 1 Defaults

Onboarding screen 1 should initialize from:

- `countryOfOrigin`: temporary draft -> saved profile -> `null`
- `countryOfResidence`: temporary draft -> saved profile -> `null`
- `preferredLocale`: temporary draft -> active route locale -> saved profile locale -> default locale

This ensures the language selector reflects the language the user is currently seeing, rather than a stale DB default.

### 3. Preserve Draft Through Locale Switch

Changing the locale route can remount the onboarding tree. Step 1 must preserve in-progress country selections and locale choice through that transition.

Use a small onboarding-specific temporary draft for step 1:

- store it in browser session storage under a single onboarding-specific key, e.g. `onboarding-step-1-locale-draft`
- shape: `{countryOfOrigin, countryOfResidence, preferredLocale}`
- writer: screen 1 locale-change handler, immediately before `router.replace(...)`
- reader: wizard step 1 default-building logic on initial render after locale change
- clear immediately after wizard step 1 has consumed the hydrated draft into in-memory defaults, or after successful step 1 save
- if parsing fails, ignore the draft and clear the bad value

This draft is only for onboarding locale transitions. It is not a general persistence layer for the full wizard.

### 4. Persist Locale to Profile

When onboarding step 1 is saved, persist the same locale value the user switched to into `user_profiles.preferred_locale`.

The same alignment rule already applies in profile settings: if the user saves profile data while browsing in a locale, the stored `preferred_locale` should match that active locale.

### 5. Restore Screen 3 Hints

`ScreenCooking` should restore the existing translated hint seams:

- oil usage hints
- rice portion hints
- sugar helper text
- protein portion hints
- broth consumption hints

No translation content changes are required; this is a component wiring fix.

## Components and Files

### Expected File Changes

| File | Change |
|------|--------|
| `components/landing-page/locale-switcher.tsx` | Move to shared locale-change behavior |
| `components/onboarding/screen-origin.tsx` | Use shared locale-change behavior and preserve step 1 draft across locale switches |
| `components/onboarding/wizard-shell.tsx` | Source step 1 locale from active route and/or temporary draft rather than stale DB-only defaults |
| `app/page.tsx` | Bootstrap bare `/` locale with authenticated profile preference before cookie fallback |
| `lib/onboarding/actions.ts` | Keep `preferred_locale` aligned with step 1 save payload |
| `components/onboarding/screen-cooking.tsx` | Pass translated hints into `OptionStrip` items |
| relevant tests | Cover locale sync, bootstrap precedence, and hint rendering |

### Boundaries

- **Locale navigation** owns switching the active route locale.
- **Onboarding draft storage** owns preserving transient step 1 values through remounts.
- **Profile persistence** owns saving long-term account preference.
- **Cooking screen** only owns rendering translated option labels and hints.

These boundaries keep locale runtime, transient onboarding state, and persistent profile state from bleeding into one another.

## Edge Cases

1. **New user lands on `/vi` but profile row defaults to `'en'`.**  
   Step 1 must show `vi`, not `en`.

2. **User selects countries, then switches onboarding language.**  
   The language should update immediately and the country selections must remain intact.

3. **User revisits bare `/` on another device after saving preferred locale.**  
   Signed-in bootstrap should respect DB preference even if the cookie is absent.

4. **User visits an explicit localized route that differs from DB preference.**  
   The route locale still wins for that render; no surprise redirect loop.

5. **Screen 3 translations exist but rendering regresses again later.**  
   Tests should fail if hints are not rendered.

6. **Unauthenticated root visit or DB read failure during root bootstrap.**  
   Locale resolution must fall back to cookie, then default locale, rather than blocking the redirect flow.

## Testing Strategy

Add or update tests to verify:

1. onboarding step 1 language defaults to the active route locale
2. onboarding locale change follows the shared locale switch path
3. step 1 draft survives the locale transition
4. bare `/` bootstrap prefers authenticated profile locale over cookie fallback when appropriate
5. cooking option hints render in both English and Vietnamese

Prefer focused component/unit coverage around the locale defaulting logic and screen 3 hint rendering, with route/bootstrap behavior covered where the repo already has the right test seams.

## Failure Handling

### Root locale bootstrap

- If the user is unauthenticated, skip profile lookup and use cookie -> default locale fallback.
- If authenticated profile lookup fails at `/`, log the server-side failure and fall back to cookie -> default locale.
- Root redirect must remain available even if profile persistence is temporarily unavailable.

### Onboarding step 1 persistence

- Locale switching in the UI happens immediately via route navigation; it does not wait for DB persistence.
- Persisting `preferred_locale` still happens on step 1 save.
- If step 1 save fails, the wizard must not advance, the draft must remain available, and the user should see the normal onboarding save error path rather than silently losing the update.
- Locale route state and DB state may be temporarily out of sync after a failed save; the next successful save reconciles them.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Locale change remount drops onboarding progress | Persist step 1 draft across the transition |
| DB preference and route locale diverge again later | Define route-locale precedence clearly and persist locale on save |
| Shared switch logic regresses one switcher while fixing another | Centralize locale switching behavior instead of duplicating it |
| Screen 3 hints disappear again during UI cleanup | Add tests that assert hint rendering from translation keys |

## Acceptance Criteria

The design is successful when:

1. switching language on onboarding step 1 changes the visible language immediately
2. landing language and onboarding language no longer drift on first use
3. bare `/` can honor an authenticated user's saved locale preference
4. step 1 draft values survive locale switching
5. screen 3 option descriptions are visible again in both supported locales
