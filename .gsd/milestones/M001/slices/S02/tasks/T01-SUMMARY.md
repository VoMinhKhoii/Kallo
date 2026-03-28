---
id: T01
parent: S02
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# T01: 02-onboarding 01

**# Phase 02 Plan 01: Onboarding Schema + TDEE Engine Summary**

## What Happened

# Phase 02 Plan 01: Onboarding Schema + TDEE Engine Summary

Drizzle migration adds 5 onboarding columns (hand_span_cm, knuckle_depth_cm, carb_split with CHECK, onboarding_step, onboarding_completed_at) and lib/onboarding/ module provides pure TDEE calculation engine (Mifflin-St Jeor BMR → TDEE → macros) with Zod v4 schemas, typed constants, and regional cooking defaults.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add onboarding columns to user_profiles schema | 9e21386 | lib/db/schema.ts, supabase/migrations/20260304142940_add_onboarding_columns.sql |
| 2 | Create TDEE calculation engine with types, constants, schemas, and tests | c8ec1f7 | lib/onboarding/types.ts, constants.ts, tdee.ts, schemas.ts, __tests__/tdee.test.ts |

## Verification Results

| Check | Result |
|-------|--------|
| bun test (14 tests) | ✅ All pass |
| grep hand_span_cm in schema | ✅ Found |
| grep carb_split in migration | ✅ Found with CHECK constraint |
| bunx tsc --noEmit | ✅ Clean |

## Deviations from Plan

None — plan executed exactly as written.

## Key Artifacts

### lib/onboarding/tdee.ts
Exports: `calcBMR`, `calcTDEE`, `calcMacroGrams`, `calcDailyTargets`
- calcDailyTargets accepts `deficitOverride?: number | null` — `??` operator falls through null/undefined to aggression preset
- Includes negative-calories warning comment for Server Action consumer

### lib/onboarding/constants.ts
Exports: `ACTIVITY_MULTIPLIERS`, `CARB_SPLIT_RATIOS`, `AGGRESSION_PRESETS`, `REGIONAL_COOKING_DEFAULTS`, `ONBOARDING_REQUIRED_STEP`, `WIZARD_DEFAULTS`, `SKIP_FALLBACK_DEFAULTS`

### lib/onboarding/schemas.ts
Exports: `bodyMetricsSchema`, `goalSchema`, `regionalSchema`, `cookingHabitsSchema`, `portionCalibrationSchema` + inferred types
- goalSchema uses superRefine: rejects cutting/bulking with null aggression
- All nullable fields use `.nullable()` (never `.optional()`) matching OnboardingProfile interface

## Self-Check: PASSED

All 7 created files exist. Both task commits (9e21386, c8ec1f7) verified in git log.

### lib/onboarding/types.ts
Exports: `BodyMetrics`, `MacroTargets`, `OnboardingProfile`, `Goal`, `Aggression`, `ActivityLevel`, `CarbSplit`, `RegionalProfile`, `CookingHabits`, `OilUsage`, `FatTrim`, `RicePortion`, `SugarBraised`
