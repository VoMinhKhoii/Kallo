# Onboarding Locale Sync & Cooking Hint Restoration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make onboarding language changes update the app immediately, keep landing/onboarding locale state aligned, restore cooking option hint text, and cover the new behavior with tests.

**Architecture:** Keep the active `/${locale}` route as the runtime source of truth, use shared client-side locale switching for landing and onboarding, preserve step 1 onboarding draft across locale-route remounts, and use `preferred_locale` only as persisted account/bootstrap state. Restore screen 3 hints by wiring existing translation keys back into the option-strip items rather than inventing new content or UI.

**Tech Stack:** Next.js App Router, next-intl, Vitest, Testing Library, sessionStorage, Supabase auth, Drizzle-backed profile persistence

**Spec:** `docs/superpowers/specs/2026-04-18-onboarding-locale-sync-design.md`

---

## File Map

### New Files
- `hooks/use-locale-switch.ts` — shared client hook that switches the current localized route and centralizes landing/onboarding locale change behavior
- `lib/i18n/root-locale.ts` — small pure helper for bare `/` locale precedence (profile -> cookie -> default)
- `lib/i18n/root-locale.test.ts` — unit coverage for authenticated/unauthenticated bootstrap precedence
- `app/page.test.tsx` — server-component seam coverage for bare `/` redirect behavior, including profile-read failure fallback
- `lib/onboarding/step-one-locale-draft.ts` — sessionStorage helpers for step 1 locale-switch draft persistence
- `lib/onboarding/step-one-defaults.ts` — pure helper that resolves step 1 defaults from transient draft, active locale, and saved profile data
- `lib/onboarding/step-one-locale-draft.test.ts` — unit coverage for draft read/write/clear behavior
- `lib/onboarding/step-one-defaults.test.ts` — unit coverage for step 1 precedence (draft -> active route -> saved profile -> default)
- `components/onboarding/screen-origin.test.tsx` — interaction test for onboarding step 1 locale switching and draft preservation handshake
- `components/onboarding/screen-cooking.test.tsx` — rendering test for restored option hints

### Modified Files
- `components/landing-page/locale-switcher.tsx` — replace inline locale switch logic with the shared hook
- `components/onboarding/screen-origin.tsx` — use shared locale switch hook, write step 1 draft before switching, keep selector aligned with active locale
- `components/onboarding/wizard-shell.tsx` — consume extracted step 1 defaults helper instead of carrying locale precedence logic inline
- `components/onboarding/wizard-shell.test.tsx` — update/extend tests for screen 1 defaulting and route-aware behavior
- `components/onboarding/screen-cooking.tsx` — pass translated hint strings into `OptionStrip` items
- `components/landing-page/locale-switcher.test.tsx` — keep switch-path coverage against the shared hook contract
- `app/page.tsx` — resolve bare `/` locale from authenticated profile preference before cookie/default fallback

### Responsibility Boundaries
- **`hooks/use-locale-switch.ts`** owns runtime locale switching only.
- **`lib/onboarding/step-one-locale-draft.ts`** owns temporary browser draft persistence only.
- **`lib/i18n/root-locale.ts`** owns bootstrap precedence only.
- **`wizard-shell.tsx` / `screen-origin.tsx`** consume these helpers; they should not reimplement them inline.

---

## Chunk 1: Shared Locale Switching + Onboarding Step 1 Sync

### Task 1: Add root-locale precedence helper with tests

**Files:**
- Create: `lib/i18n/root-locale.ts`
- Test: `lib/i18n/root-locale.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {describe, expect, it} from 'vitest';
import {resolveRootLocale} from './root-locale';

describe('resolveRootLocale', () => {
  it('prefers authenticated profile locale over cookie', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: true,
        profileLocale: 'vi',
        cookieLocale: 'en',
        defaultLocale: 'en'
      })
    ).toBe('vi');
  });

  it('falls back to cookie for unauthenticated users', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: false,
        profileLocale: 'vi',
        cookieLocale: 'en',
        defaultLocale: 'en'
      })
    ).toBe('en');
  });

  it('falls back to default when profile and cookie locales are absent', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: true,
        profileLocale: null,
        cookieLocale: null,
        defaultLocale: 'en'
      })
    ).toBe('en');
  });

  it('falls back to default when profile and cookie locales are invalid', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: true,
        profileLocale: 'fr',
        cookieLocale: 'jp',
        defaultLocale: 'en'
      })
    ).toBe('en');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bunx vitest run lib/i18n/root-locale.test.ts
```

Expected: FAIL because `resolveRootLocale` does not exist yet.

- [ ] **Step 3: Write the minimal helper**

```ts
import type {Locale} from '@/i18n/config';

interface ResolveRootLocaleArgs {
  isAuthenticated: boolean;
  profileLocale?: string | null;
  cookieLocale?: string | null;
  defaultLocale: Locale;
}

export function resolveRootLocale({
  isAuthenticated,
  profileLocale,
  cookieLocale,
  defaultLocale
}: ResolveRootLocaleArgs): Locale {
  if (isAuthenticated && (profileLocale === 'en' || profileLocale === 'vi')) {
    return profileLocale;
  }

  if (cookieLocale === 'en' || cookieLocale === 'vi') {
    return cookieLocale;
  }

  return defaultLocale;
}
```

- [ ] **Step 4: Re-run the test**

Run:

```bash
bunx vitest run lib/i18n/root-locale.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/root-locale.ts lib/i18n/root-locale.test.ts
git commit -m "test: cover root locale precedence"
```

### Task 2: Add shared locale-switch hook and keep landing switcher green

**Files:**
- Create: `hooks/use-locale-switch.ts`
- Modify: `components/landing-page/locale-switcher.tsx`
- Test: `components/landing-page/locale-switcher.test.tsx`

- [ ] **Step 1: Extend the existing landing switcher test so it still verifies route replacement through the shared path**

```ts
expect(replaceMock).toHaveBeenCalledWith('/dashboard', {locale: 'vi'});
```

Keep the current test, but make sure the mock shape still matches the new hook usage.

- [ ] **Step 2: Run the landing switcher test**

Run:

```bash
bunx vitest run components/landing-page/locale-switcher.test.tsx
```

Expected: FAIL after the component import changes and before the hook exists.

- [ ] **Step 3: Add the shared hook and wire the landing switcher to it**

```ts
'use client';

import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import type {Locale} from '@/i18n/config';

export function useLocaleSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  return (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    router.replace(pathname, {locale: nextLocale});
  };
}
```

Then in `LocaleSwitcher`, replace the inline `handleChange` body with the hook.

- [ ] **Step 4: Re-run the landing switcher test**

Run:

```bash
bunx vitest run components/landing-page/locale-switcher.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-locale-switch.ts components/landing-page/locale-switcher.tsx components/landing-page/locale-switcher.test.tsx
git commit -m "refactor: share locale switch behavior"
```

### Task 3: Add step-1 draft helpers with tests

**Files:**
- Create: `lib/onboarding/step-one-locale-draft.ts`
- Test: `lib/onboarding/step-one-locale-draft.test.ts`

- [ ] **Step 1: Write the failing draft-storage tests**

```ts
import {beforeEach, describe, expect, it} from 'vitest';
import {
  clearStepOneLocaleDraft,
  readStepOneLocaleDraft,
  writeStepOneLocaleDraft
} from './step-one-locale-draft';

describe('step-one locale draft', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips the onboarding draft', () => {
    writeStepOneLocaleDraft({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi'
    });

    expect(readStepOneLocaleDraft()).toEqual({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi'
    });
  });

  it('clears malformed JSON payloads', () => {
    sessionStorage.setItem('onboarding-step-1-locale-draft', '{bad json');

    expect(readStepOneLocaleDraft()).toBeNull();
    expect(sessionStorage.getItem('onboarding-step-1-locale-draft')).toBeNull();
  });

  it('clears parsed payloads with invalid locale values', () => {
    sessionStorage.setItem(
      'onboarding-step-1-locale-draft',
      JSON.stringify({
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        preferredLocale: 'fr'
      })
    );

    expect(readStepOneLocaleDraft()).toBeNull();
    expect(sessionStorage.getItem('onboarding-step-1-locale-draft')).toBeNull();
  });

  it('clears a previously stored draft', () => {
    writeStepOneLocaleDraft({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi'
    });

    clearStepOneLocaleDraft();

    expect(readStepOneLocaleDraft()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the draft-storage test**

Run:

```bash
bunx vitest run lib/onboarding/step-one-locale-draft.test.ts
```

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Implement the minimal sessionStorage helper**

```ts
const KEY = 'onboarding-step-1-locale-draft';

export interface StepOneLocaleDraft {
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
  preferredLocale: 'en' | 'vi';
}

export function writeStepOneLocaleDraft(value: StepOneLocaleDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function readStepOneLocaleDraft(): StepOneLocaleDraft | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StepOneLocaleDraft>;

    if (
      (parsed.preferredLocale !== 'en' && parsed.preferredLocale !== 'vi') ||
      !('countryOfOrigin' in parsed) ||
      !('countryOfResidence' in parsed)
    ) {
      sessionStorage.removeItem(KEY);
      return null;
    }

    return {
      countryOfOrigin: parsed.countryOfOrigin ?? null,
      countryOfResidence: parsed.countryOfResidence ?? null,
      preferredLocale: parsed.preferredLocale
    };
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function clearStepOneLocaleDraft() {
  sessionStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Re-run the draft-storage test**

Run:

```bash
bunx vitest run lib/onboarding/step-one-locale-draft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/step-one-locale-draft.ts lib/onboarding/step-one-locale-draft.test.ts
git commit -m "test: cover onboarding locale draft storage"
```

### Task 4: Wire onboarding step 1 to the shared locale switch and transient draft

**Files:**
- Create: `lib/onboarding/step-one-defaults.ts`
- Create: `lib/onboarding/step-one-defaults.test.ts`
- Modify: `components/onboarding/screen-origin.tsx`
- Modify: `components/onboarding/wizard-shell.tsx`
- Create: `components/onboarding/screen-origin.test.tsx`
- Modify: `components/onboarding/wizard-shell.test.tsx`

- [ ] **Step 1: Write the failing onboarding tests**

Add focused tests for:

```ts
it('uses draft locale first when present');
it('defaults step 1 locale to the active route locale');
it('prefers the active route locale over a conflicting saved profile locale');
it('falls back to saved profile locale when active locale is unavailable');
it('falls back to default locale last');
it('switches locales via router.replace(pathname, {locale}) rather than local-only state');
it('writes the current step 1 draft before switching locale');
it('hydrates step 1 from the transient draft after remount');
it('clears the transient draft immediately after hydration');
it('saves the hydrated preferredLocale when the user clicks Next');
```

Put the pure precedence cases in `lib/onboarding/step-one-defaults.test.ts`, and keep the interaction/remount/save assertions in the component tests. Use existing repo mocks for `next-intl` and `@/i18n/navigation`.

- [ ] **Step 2: Run only the onboarding tests**

Run:

```bash
bunx vitest run lib/onboarding/step-one-defaults.test.ts components/onboarding/screen-origin.test.tsx components/onboarding/wizard-shell.test.tsx
```

Expected: FAIL because the new locale-default and draft-preservation behavior is not implemented yet.

- [ ] **Step 3: Implement the minimal wiring**

Make these changes:

1. In `wizard-shell.tsx`, source step 1 defaults from:
   - a dedicated `lib/onboarding/step-one-defaults.ts` helper, not inline branching in `wizard-shell.tsx`
   - transient draft first
   - saved country fields next
   - current route locale next
   - saved `preferredLocale` next
   - default locale last
2. In `screen-origin.tsx`, replace local-only locale switching with:
   - write current `{countryOfOrigin, countryOfResidence, preferredLocale: nextLocale}` draft
   - call shared locale switch hook
3. In `wizard-shell.tsx`, read the active locale from `useLocale()` so the route remains the runtime source of truth.
4. After hydration, clear the transient draft so the next open starts fresh.
5. Keep `saveOnboardingScreen(1, data)` behavior aligned by asserting in `wizard-shell.test.tsx` that the hydrated locale survives through the existing step-1 save path when the user clicks Next.

Illustrative default assembly:

```ts
export function buildStepOneDefaults({
  draft,
  activeLocale,
  profilePreferredLocale,
  countryOfOrigin,
  countryOfResidence
}: Args) {
  return {
    countryOfOrigin: draft?.countryOfOrigin ?? countryOfOrigin ?? null,
    countryOfResidence: draft?.countryOfResidence ?? countryOfResidence ?? null,
    preferredLocale:
      draft?.preferredLocale ??
      activeLocale ??
      profilePreferredLocale ??
      'en'
  };
}
```

Add an explicit test assertion that the draft key is removed after hydration succeeds.

- [ ] **Step 4: Re-run the onboarding tests**

Run:

```bash
bunx vitest run lib/onboarding/step-one-defaults.test.ts components/onboarding/screen-origin.test.tsx components/onboarding/wizard-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/step-one-defaults.ts lib/onboarding/step-one-defaults.test.ts components/onboarding/screen-origin.tsx components/onboarding/wizard-shell.tsx components/onboarding/screen-origin.test.tsx components/onboarding/wizard-shell.test.tsx
git commit -m "fix: sync onboarding locale with active route"
```

---

## Chunk 2: Root Bootstrap + Cooking Hint Restoration + Final Verification

### Task 5: Wire bare `/` bootstrap to authenticated profile locale precedence

**Files:**
- Modify: `app/page.tsx`
- Create: `app/page.test.tsx`
- Test: `lib/i18n/root-locale.test.ts`

- [ ] **Step 1: Extend the root-locale tests for DB-failure and default fallback behavior**

```ts
it('returns cookie locale when authenticated profile locale is missing');
it('returns default locale when both profile and cookie locales are missing');
it('returns default locale when profile and cookie locales are unsupported');
```

- [ ] **Step 2: Write the failing `app/page.tsx` tests**

Cover these paths with mocks for `next/headers`, `next/navigation`, and the auth/profile read seams:

```ts
it('redirects bare / to "/vi" when the authenticated profile locale is vi');
it('redirects bare / to "/en" when unauthenticated and cookie locale is en');
it('redirects bare / to "/vi" when profile lookup fails but cookie locale is vi');
it('redirects bare / to "/en" when neither profile nor cookie provides a supported locale');
it('calls console.error once when profile lookup fails before falling back');
```

Mock these exact call sites rather than inventing a new seam mid-task:

- `createClient().auth.getUser()` for auth presence
- `getOnboardingProfile()` for profile locale lookup
- `cookies()` for cookie fallback
- `redirect()` for the final route assertion

- [ ] **Step 3: Run the bootstrap tests and verify they fail**

Run:

```bash
bunx vitest run lib/i18n/root-locale.test.ts app/page.test.tsx
```

Expected: FAIL until both the helper and `app/page.tsx` call site match the final contract.

- [ ] **Step 4: Update `app/page.tsx` to use authenticated bootstrap precedence and failure logging**

Implementation target:

1. Read the locale cookie.
2. If authenticated, attempt to load the profile locale.
3. Resolve with `resolveRootLocale(...)`.
4. On auth/profile read failure, log the server-side failure and fall back to cookie -> default locale rather than blocking redirect.

Keep the redirect behavior in `app/page.tsx`; do not move locale bootstrap into unrelated components.

- [ ] **Step 5: Re-run the bootstrap tests**

Run:

```bash
bunx vitest run lib/i18n/root-locale.test.ts app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.test.tsx lib/i18n/root-locale.ts lib/i18n/root-locale.test.ts
git commit -m "fix: bootstrap root locale from profile preference"
```

### Task 6: Restore cooking option hints and cover them with tests

**Files:**
- Modify: `components/onboarding/screen-cooking.tsx`
- Create: `components/onboarding/screen-cooking.test.tsx`

- [ ] **Step 1: Write the failing cooking hint test**

Add a rendering test that asserts translated option hints appear for every restored hint seam, and do it for both locales by locally mocking `useTranslations` with concrete English and Vietnamese strings instead of relying only on the global key-as-text mock. Follow `components/settings/profile/cooking.tsx` as the wiring source of truth for oil/rice/protein/broth per-option hints, and explicitly assert a single field-level `sugarHint` helper line for sugar.

```ts
expect(screen.getByText('Dry, clean taste. Dish looks matte.')).toBeInTheDocument();
expect(screen.getByText('Light coating. Slight sheen on food.')).toBeInTheDocument();
expect(screen.getByText('Visibly oily. Sauce pools slightly.')).toBeInTheDocument();
expect(screen.getByText('~1 small bowl')).toBeInTheDocument();
expect(screen.getByText('~1–1.5 bowls')).toBeInTheDocument();
expect(screen.getByText('~2+ bowls')).toBeInTheDocument();
expect(screen.getByText('How much sugar you use for caramelizing/braising')).toBeInTheDocument();
expect(screen.getByText('Smaller than your palm, e.g. ~2-3 eggs')).toBeInTheDocument();
expect(screen.getByText('About palm-sized')).toBeInTheDocument();
expect(screen.getByText('Bigger than your palm, e.g. a chicken thigh or more')).toBeInTheDocument();
expect(screen.getByText('Eat the solids, skip most broth')).toBeInTheDocument();
expect(screen.getByText('Drink about half the bowl')).toBeInTheDocument();
expect(screen.getByText('Drink all or most of the broth')).toBeInTheDocument();
```

Repeat the same coverage with Vietnamese strings in a second locale case.

```ts
expect(screen.getByText('Vị khô, thanh. Món ăn trông ráo.')).toBeInTheDocument();
expect(screen.getByText('~1 chén nhỏ')).toBeInTheDocument();
expect(screen.getByText('Lượng đường bạn dùng để kho/rim')).toBeInTheDocument();
expect(screen.getByText('Cỡ khoảng lòng bàn tay')).toBeInTheDocument();
expect(screen.getByText('Uống hết hoặc gần hết nước')).toBeInTheDocument();
```

- [ ] **Step 2: Run the cooking hint test**

Run:

```bash
bunx vitest run components/onboarding/screen-cooking.test.tsx
```

Expected: FAIL because the hint props are not passed into the option-strip items yet.

- [ ] **Step 3: Restore the hint wiring**

Update the onboarding screen to match the existing settings/profile cooking pattern:

- oil/rice/protein/broth `OptionStrip` items get their per-option `hint` translation key
- sugar renders the existing single `t('cooking.sugarHint')` helper copy at the field level instead of inventing per-option sugar hints

Illustrative oil option:

```ts
{
  value: 'minimal',
  label: t('cooking.oilMinimal'),
  hint: t('cooking.oilMinimalHint')
}
```

Repeat the per-option hint restoration for rice, protein, and broth only. Sugar is field-level helper text, not per-option hint text.

- [ ] **Step 4: Re-run the cooking hint test**

Run:

```bash
bunx vitest run components/onboarding/screen-cooking.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/screen-cooking.tsx components/onboarding/screen-cooking.test.tsx
git commit -m "fix: restore onboarding cooking hints"
```

### Task 7: Run focused regression checks, then repo-wide checks

**Files:**
- Modify: none
- Test: focused Vitest files above

- [ ] **Step 1: Run the focused regression suite**

```bash
bunx vitest run \
  app/page.test.tsx \
  lib/i18n/root-locale.test.ts \
  lib/onboarding/step-one-locale-draft.test.ts \
  lib/onboarding/step-one-defaults.test.ts \
  components/landing-page/locale-switcher.test.tsx \
  components/onboarding/screen-origin.test.tsx \
  components/onboarding/wizard-shell.test.tsx \
  components/onboarding/screen-cooking.test.tsx
```

Expected: PASS for all targeted locale-sync and hint-restoration tests.

- [ ] **Step 2: Run repo formatting autofix**

```bash
bunx @biomejs/biome check --write .
```

Expected: only intended formatting fixes.

- [ ] **Step 3: Verify git diff stayed focused**

```bash
git --no-pager status --short
```

Expected: only intended onboarding/locale-sync files are modified.

- [ ] **Step 4: Run repo lint/check**

```bash
bunx @biomejs/biome check .
```

Expected: PASS.

- [ ] **Step 5: Run the repo test suite**

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 6: Verify the working tree is clean after the task-level commits**

```bash
git --no-pager status --short
```

Expected: no unexpected tracked changes remain. If Biome changed files after the earlier task commits, stage only those intended formatting updates and create a final `chore:` commit.
