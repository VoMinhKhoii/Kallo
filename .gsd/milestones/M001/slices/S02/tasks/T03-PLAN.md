# T03: 02-onboarding 03

**Slice:** S02 — **Milestone:** M001

## Description

Build Screens 2-4 of the onboarding wizard: regional profile selection, cooking habits with regional pre-population, and optional portion calibration. Wire all screens into the existing wizard shell.

Purpose: These complete the onboarding data collection. Screen 2 determines regional cooking defaults. Screen 3 lets users refine. Screen 4 captures optional hand measurements.
Output: All 4 onboarding screens functional with complete save/navigation flow.

## Must-Haves

- [ ] "User sees 4 regional profile cards with AI-behavior-framed Vietnamese descriptions"
- [ ] "Cooking habits screen pre-populates from REGIONAL_COOKING_DEFAULTS once on first mount"
- [ ] "User can override any pre-populated cooking habit value"
- [ ] "Single fat-trim toggle in UI, server action fans out to 3 columns"
- [ ] "Portion calibration screen is skippable with clear Skip CTA"
- [ ] "Completing screen 3 triggers onboardingCompletedAt in server action"
- [ ] "Full wizard flow works end-to-end across all 4 screens"

## Files

- `components/onboarding/screen-regional.tsx`
- `components/onboarding/screen-cooking.tsx`
- `components/onboarding/screen-portions.tsx`
- `components/onboarding/wizard-shell.tsx`
