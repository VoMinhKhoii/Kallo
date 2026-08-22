# i18n Setup + Onboarding Reorder Design

**Date**: 2026-04-17
**Status**: Approved

## Problem

The app has all UI strings hardcoded in English. The primary user base includes Vietnamese speakers who would benefit from a native-language experience. Additionally, the onboarding screen order is suboptimal — the country/origin screen (Screen 2) should come first so users can set their preferred language before proceeding through body metrics and cooking habits screens in their chosen language.

## Scope

Three distinct changes:

1. **Worktree cleanup** — remove 6 stale worktrees and their local branches
2. **Full i18n setup** — next-intl with always-prefix locale routing, ~270 strings translated to EN + VI
3. **Onboarding reorder** — move Origin screen to position 1, add language toggle with flag icons

## Approach

### i18n Library: next-intl

Selected for: full App Router / RSC support, middleware-based locale routing, TypeScript-safe translation keys, battle-tested ecosystem.

### Locale Routing: Always Prefix

- `/en/logging`, `/vi/logging` — every route includes locale prefix
- No bare `/logging` — middleware redirects to default locale prefix
- API routes (`app/api/`) stay locale-agnostic; locale passed via `Accept-Language` header when needed

### Middleware Composition

next-intl middleware runs first (resolves locale from URL path), then Supabase auth middleware runs. Both compose in `middleware.ts`.

## Architecture

### Route Restructuring

```
app/
  [locale]/
    layout.tsx              ← root layout, NextIntlClientProvider
    page.tsx                ← landing page
    (app)/
      layout.tsx            ← authenticated app layout
      onboarding/page.tsx
      logging/page.tsx
      settings/
        page.tsx
        layout.tsx
      dashboard/page.tsx
  api/                      ← stays at app root, no locale prefix
    analyze-meal/
      route.ts
      debug/route.ts
```

### Translation Files

```
messages/
  en.json
  vi.json
```

Namespaced by feature:

```json
{
  "common": {},
  "onboarding": {
    "origin": {},
    "bodyMetrics": {},
    "cooking": {}
  },
  "auth": { "signIn": {}, "signUp": {} },
  "landing": { "hero": {}, "problem": {}, "solution": {} },
  "dashboard": {},
  "logging": {},
  "settings": {},
  "nav": {}
}
```

English is the source-of-truth file. Missing Vietnamese keys fall back to English text.

### i18n Config Files

- `i18n/config.ts` — locale list (`en`, `vi`), default locale (`en`)
- `i18n/request.ts` — next-intl server config (locale resolution from URL path)
- `next.config.ts` — wrapped with `createNextIntlPlugin`

### Component Translation Patterns

**Server Components** (default):
```tsx
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('onboarding.origin');
  return <h2>{t('title')}</h2>;
}
```

**Client Components** (`'use client'`):
```tsx
import { useTranslations } from 'next-intl';

export function ScreenOrigin() {
  const t = useTranslations('onboarding.origin');
  return <h2>{t('title')}</h2>;
}
```

## Onboarding Reorder

### New Screen Order

| Step | Screen | Content |
|------|--------|---------|
| 1 | Origin + Language | Preferred language toggle (EN/VI with flag icons), country of origin, country of residence |
| 2 | Body Metrics | Weight, height, age, sex, activity level, goal, aggression, carb split |
| 3 | Cooking Habits | Oil usage, rice portion, sugar, protein portion, broth consumption |

### Language Toggle Design

Position: top of Screen 1, before country pickers.

UI: Two-option toggle strip with country flag icons from the `country-flag-icons` package (GB flag for English, VN flag for Vietnamese). Uses the existing `OptionStrip`-like pattern from the cooking screen. **Exception**: This overrides the AGENTS.md rule against non-Lucide icon libraries — Lucide does not provide country flag icons, and this is the only use case for `country-flag-icons` in the app.

Behavior:
- Selecting a language uses `router.replace()` (from `next-intl/navigation`) to switch the locale prefix in the URL (e.g., `/en/onboarding` → `/vi/onboarding`)
- `router.replace()` performs a client-side navigation that preserves React state — the `WizardShell` component re-renders with the new locale. To preserve in-progress form data (country selections), the Screen 1 component stores its current values in a `useRef` and passes them via the `onChange` callback before triggering the locale switch. The wizard shell's `screenData` state survives because `replace()` is a shallow navigation within the same `[locale]` layout boundary.
- Preference is saved to DB when "Next Step" is clicked
- All subsequent screens render in the selected language

### Navigation & Link Migration

All `useRouter` and `<Link>` imports must change from `next/navigation` and `next/link` to their `next-intl/navigation` equivalents (`useRouter`, `Link`, `redirect`, `usePathname`) for locale-aware routing. This affects:
- `wizard-shell.tsx` — `router.push('/logging')` → locale-aware `router.push('/logging')`
- Any `redirect()` calls in server components
- All `<Link>` components across the app

### `onboarding_step` Semantics Change

The `onboarding_step` values change meaning but the DB constraint (0–3) stays the same:

| Step | Before | After |
|------|--------|-------|
| 0 | Not started | Not started |
| 1 | Body Metrics complete | Origin + Language complete |
| 2 | Origin complete | Body Metrics complete |
| 3 | Cooking complete | Cooking complete |

Since onboarding is optional and users can skip screens, this reorder is backward-compatible. Existing users who completed onboarding (`onboarding_step = 3`) remain unaffected.

### `saveOnboardingScreen` Field Mapping Update

**Critical**: The server action `saveOnboardingScreen` in `lib/onboarding/actions.ts` hardcodes step-to-field mappings:

| Step | Before (current code) | After (must update) |
|------|----------------------|---------------------|
| 1 | Body metrics fields (weight, height, age, sex, activity, goal...) | Country fields (countryOfOrigin, countryOfResidence) + preferredLocale |
| 2 | Country fields (countryOfOrigin, countryOfResidence) | Body metrics fields (weight, height, age, sex, activity, goal...) |
| 3 | Cooking habits (unchanged) | Cooking habits (unchanged) |

The `if (step === 1)` / `else if (step === 2)` branches must swap their field assignments. The `buildScreenOneDefaults` / `screenTwoDefaults` logic in `wizard-shell.tsx` must also swap accordingly.

## Database Changes

### New Column

Add `preferred_locale text` to `user_profiles`:

```sql
ALTER TABLE user_profiles ADD COLUMN preferred_locale text DEFAULT 'en';
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_preferred_locale_check
  CHECK (preferred_locale IN ('en', 'vi'));
```

### Drizzle Schema Update

```ts
// In lib/db/schema.ts, inside userProfiles:
preferredLocale: text('preferred_locale').default('en'),
```

Plus CHECK constraint in the table config array.

### Migration Strategy

1. Edit `lib/db/schema.ts` — add `preferredLocale` column + CHECK
2. Run `bun db:generate` — creates migration SQL
3. Rename migration to meaningful name
4. User runs `bun dbr:push` to apply remotely

## Translation Scope

All hardcoded UI strings extracted to translation keys:

| Area | Components | Est. Strings |
|------|-----------|-------------|
| Onboarding (3 screens) | wizard-shell, screen-origin, screen-body-metrics, screen-cooking | ~80 |
| Auth | sign-in-form, sign-up-form, form-input | ~25 |
| Landing page | hero, problem-section, solution-section | ~40 |
| Dashboard | dashboard-shell, today/, progress/ | ~30 |
| Logging | feed/, input/, sidebar/ | ~30 |
| Settings | profile/, shell, regional | ~30 |
| App shell | app-shell, main-sidebar | ~15 |
| Common | buttons, labels, errors | ~20 |
| **Total** | | **~270** |

Vietnamese translations written manually (not machine-translated) for natural phrasing, especially food/nutrition/cooking terminology.

## Worktree Cleanup

Remove all 6 non-main worktrees:

| Worktree | Branch |
|----------|--------|
| kallo-stream-a | opt/streaming-perceived-perf |
| kallo-stream-b | opt/pipeline-performance |
| kallo-stream-c | opt/meal-persistence-data-layer |
| kallo-stream-d | opt/hardening-error-resilience |
| kallo-stream-e | opt/devex-polish |
| kallo-usda-enrichment | fix/real-meal-nutrition-value |

Commands: `git worktree remove <path>` for each, then `git branch -D <branch>` to clean up local branches. Remote branches untouched.

## Testing Strategy

- Unit tests for locale resolution logic
- Verify all translation keys exist in both EN and VI files (CI script)
- Existing onboarding tests updated for new screen order
- Verify middleware correctly chains next-intl + Supabase auth

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Route restructuring breaks existing links/bookmarks | Middleware redirects bare paths to locale-prefixed versions |
| Missing Vietnamese translations | English fallback configured; CI script catches key mismatches |
| Onboarding step reorder confuses existing users | Users with `onboarding_step = 3` (completed) are unaffected; in-progress users see correct screens since step maps to completion, not screen identity |
| Middleware composition breaks auth | Test both locale resolution and auth flow together; Supabase middleware runs after next-intl |
