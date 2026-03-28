# T02: 02-onboarding 02

**Slice:** S02 — **Milestone:** M001

## Description

Build the onboarding wizard infrastructure (route, layout, step indicator, server actions) and the most complex screen — Screen 1 (body metrics + live TDEE + goal selection + aggression + carb splits).

Purpose: This is the core wizard shell that all screens plug into, plus the hardest screen to get right (like tdeecalculator.net). Screen 1 validates that the TDEE engine from Plan 01 correctly drives a real-time UI.
Output: Working onboarding route at /onboarding with functional Screen 1 and save/load persistence.

## Must-Haves

- [ ] "Authenticated user can navigate to /onboarding and see wizard with step indicator"
- [ ] "User fills body metrics fields and sees live TDEE recalculation (no server round-trip)"
- [ ] "User selects goal and aggression and sees macro table update in real-time"
- [ ] "User selects carb split and sees macros adjust instantly"
- [ ] "User edits deficit/surplus override and macros recalculate"
- [ ] "On Next click, screen data is saved to user_profiles via server action"
- [ ] "On page reload, wizard resumes at highest completed step with data pre-filled"

## Files

- `app/(onboarding)/onboarding/layout.tsx`
- `app/(onboarding)/onboarding/page.tsx`
- `components/onboarding/wizard-shell.tsx`
- `components/onboarding/step-indicator.tsx`
- `components/onboarding/screen-body-metrics.tsx`
- `lib/onboarding/actions.ts`
