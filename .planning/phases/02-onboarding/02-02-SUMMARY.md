---
phase: 02-onboarding
plan: 02
subsystem: onboarding-ui
tags: [react-hook-form, zod, tdee, wizard, shadcn, server-actions, drizzle]

dependency_graph:
  requires:
    - phase: 02-01
      provides: TDEE calculation engine, onboarding types/constants/schemas, user_profiles columns
  provides:
    - Onboarding wizard shell with step navigation and save-on-next
    - Server actions for profile CRUD (getOnboardingProfile, saveOnboardingScreen)
    - Screen 1 with live TDEE, 3x3 macro reference matrix, aggression fine-tuning
    - Auth-gated onboarding layout without sidebar
    - Step indicator component
  affects: [02-03 regional + cooking screens, 02-04 middleware gate]

tech_stack:
  added: []
  patterns: [merged zod schema for multi-section screen, useMemo matrix computation, onBlur form mode for number inputs, server action with max-step logic and fallback defaults]

key_files:
  created:
    - app/(onboarding)/onboarding/layout.tsx
    - app/(onboarding)/onboarding/page.tsx
    - components/onboarding/wizard-shell.tsx
    - components/onboarding/step-indicator.tsx
    - components/onboarding/screen-body-metrics.tsx
    - lib/onboarding/actions.ts
  modified: []

key_decisions:
  - "screen1Schema = bodyMetricsSchema.merge(goalSchema) — single merged schema for Screen 1 validation"
  - "Form mode: onBlur — prevents validation on every keystroke for number inputs"
  - "onChange reports on blur/discrete changes only — no per-keystroke re-renders to wizard shell"
  - "Reference matrix always uses 'moderate' aggression — fine-tuning section handles actual pace selection"
  - "Server action fetches existing row before update for max-step logic and fallback default checks"

patterns_established:
  - "WizardShell pattern: screens call onChange to update in-memory state, save happens only on Next click via server action"
  - "Screen pattern: merged schema, watch() for local computation, reportChange() for discrete upstream events"

requirements_completed: [ONB-01, ONB-02, ONB-03, ONB-07]

duration: 12min
completed: "2026-03-04"
---

# Phase 02 Plan 02: Onboarding Wizard + Screen 1 Summary

**Onboarding wizard shell with step navigation, server action persistence, and Screen 1 featuring live TDEE computation, 3×3 macro reference matrix, and aggression/deficit fine-tuning**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-04T14:44:17Z
- **Completed:** 2026-03-04T14:56:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Auth-gated /onboarding route with dedicated layout (no sidebar, centered max-w-3xl)
- WizardShell with step indicator, back/next navigation, and save-on-next via server action
- Server actions: getOnboardingProfile (load) + saveOnboardingScreen (save with max-step, calorie floor ≥500, fatTrim fan-out to 3 columns, SKIP_FALLBACK_DEFAULTS on completion)
- Screen 1: body metrics form → live BMR/TDEE → 3×3 reference matrix (moderate aggression) → click cell to set goal/carbSplit → fine-tuning with aggression radio + deficit override → live final targets display
- Completion redirect: onboardingStep ≥ ONBOARDING_REQUIRED_STEP → redirect to /logging
- Resume: wizard resumes at highest completed step + 1 with data pre-filled

## Task Commits

Each task was committed atomically:

1. **Task 1: Wizard infrastructure — route, layout, server actions, step indicator** - `b7b3b71` (feat)
2. **Task 2: Screen 1 — body metrics, live TDEE, reference matrix, fine-tuning** - `d593743` (feat)

## Files Created/Modified
- `app/(onboarding)/onboarding/layout.tsx` - Auth-gated layout without sidebar
- `app/(onboarding)/onboarding/page.tsx` - Server component loading profile and rendering wizard
- `components/onboarding/wizard-shell.tsx` - Client component managing step state, navigation, screen rendering
- `components/onboarding/step-indicator.tsx` - Visual step progress with completed/current/future states
- `components/onboarding/screen-body-metrics.tsx` - Screen 1 with body metrics form, live TDEE, reference matrix, fine-tuning
- `lib/onboarding/actions.ts` - Server actions for profile CRUD with step-specific field mapping

## Decisions Made
- `screen1Schema = bodyMetricsSchema.merge(goalSchema)` — single merged Zod schema for Screen 1 validation
- Form mode set to `onBlur` — prevents validation spam on number inputs while still catching errors
- onChange reports to wizard shell on blur events (numbers) and immediate change (select/radio) — avoids per-keystroke re-renders
- Reference matrix always uses 'moderate' aggression — labeled "Shown at moderate pace" so users know to fine-tune
- Server action fetches existing row before every update — needed for max-step comparison and null-check on fallback defaults

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wizard shell ready for Screens 2-4 (placeholder divs rendered for steps 2-4)
- Server action already handles all 4 step field mappings
- Step indicator and navigation work for all 4 steps
- Plan 03 needs: ScreenRegionalProfile (step 2), ScreenCookingHabits (step 3), ScreenPortionCalibration (step 4)

## Self-Check: PASSED

All 6 created files exist. Both task commits (b7b3b71, d593743) verified in git log.

---
*Phase: 02-onboarding*
*Completed: 2026-03-04*
