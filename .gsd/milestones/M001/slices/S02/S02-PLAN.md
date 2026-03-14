# S02: Onboarding

**Goal:** Create the foundational data layer for onboarding: schema columns for new fields (hand measurements, carb split preference, onboarding progress tracking) and a pure TDEE calculation engine with types, constants, Zod schemas, and regional cooking defaults.
**Demo:** Create the foundational data layer for onboarding: schema columns for new fields (hand measurements, carb split preference, onboarding progress tracking) and a pure TDEE calculation engine with types, constants, Zod schemas, and regional cooking defaults.

## Must-Haves


## Tasks

- [x] **T01: 02-onboarding 01**
  - Create the foundational data layer for onboarding: schema columns for new fields (hand measurements, carb split preference, onboarding progress tracking) and a pure TDEE calculation engine with types, constants, Zod schemas, and regional cooking defaults.

Purpose: Everything in the onboarding wizard depends on these — the TDEE module drives Screen 1's live calculations, the types/schemas validate all form inputs, the constants define the domain rules (WIZARD_DEFAULTS for form initialization, SKIP_FALLBACK_DEFAULTS for DB writes when user skips Screen 4), and the schema columns store the results.
Output: Drizzle migration for 5 new columns + complete `lib/onboarding/` module with tested TDEE functions.
- [x] **T02: 02-onboarding 02** `est:12min`
  - Build the onboarding wizard infrastructure (route, layout, step indicator, server actions) and the most complex screen — Screen 1 (body metrics + live TDEE + goal selection + aggression + carb splits).

Purpose: This is the core wizard shell that all screens plug into, plus the hardest screen to get right (like tdeecalculator.net). Screen 1 validates that the TDEE engine from Plan 01 correctly drives a real-time UI.
Output: Working onboarding route at /onboarding with functional Screen 1 and save/load persistence.
- [x] **T03: 02-onboarding 03**
  - Build Screens 2-4 of the onboarding wizard: regional profile selection, cooking habits with regional pre-population, and optional portion calibration. Wire all screens into the existing wizard shell.

Purpose: These complete the onboarding data collection. Screen 2 determines regional cooking defaults. Screen 3 lets users refine. Screen 4 captures optional hand measurements.
Output: All 4 onboarding screens functional with complete save/navigation flow.
- [x] **T04: 02-onboarding 04** `est:7min`
  - Build the settings profile editor (edit all onboarding fields post-wizard) and the onboarding nudge system (home card for incomplete onboarding + time-based nudge dialog).

Purpose: ONB-07 requires the profile to be "editable from settings at any time." The nudge system gently prompts users who haven't completed onboarding without blocking app access.
Output: Working settings page + dismissible home card + nudge dialog.

## Files Likely Touched

- `lib/db/schema.ts`
- `supabase/migrations/NEW_add_onboarding_columns.sql`
- `lib/onboarding/tdee.ts`
- `lib/onboarding/types.ts`
- `lib/onboarding/constants.ts`
- `lib/onboarding/schemas.ts`
- `lib/onboarding/__tests__/tdee.test.ts`
- `app/(onboarding)/onboarding/layout.tsx`
- `app/(onboarding)/onboarding/page.tsx`
- `components/onboarding/wizard-shell.tsx`
- `components/onboarding/step-indicator.tsx`
- `components/onboarding/screen-body-metrics.tsx`
- `lib/onboarding/actions.ts`
- `components/onboarding/screen-regional.tsx`
- `components/onboarding/screen-cooking.tsx`
- `components/onboarding/screen-portions.tsx`
- `components/onboarding/wizard-shell.tsx`
- `app/(app)/settings/page.tsx`
- `components/onboarding/profile-editor.tsx`
- `components/onboarding/onboarding-card.tsx`
- `components/onboarding/nudge-dialog.tsx`
- `components/onboarding/onboarding-prompt.tsx`
- `app/(app)/logging/page.tsx`
- `lib/onboarding/actions.ts`
- `components/app/main-sidebar.tsx`
