---
id: T04
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
duration: 7min
verification_result: passed
completed_at: 2026-03-04
blocker_discovered: false
---
# T04: 02-onboarding 04

**# Phase 02 Plan 04: Settings Profile Editor + Onboarding Nudge System Summary**

## What Happened

# Phase 02 Plan 04: Settings Profile Editor + Onboarding Nudge System Summary

**Full profile editor at /settings with per-protein fat-trim, editable calorie targets with TDEE overwrite, and SSR-safe onboarding nudge system (dismissible home card + time-based dialog with 2-dismiss cap)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T15:19:07Z
- **Completed:** 2026-03-04T15:26:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Settings page at /settings with comprehensive ProfileEditor covering all onboarding fields
- saveProfileSettings server action with typed fields, null guards for hand measurements → SKIP_FALLBACK_DEFAULTS
- 3 separate fat-trim controls (Mỡ heo, Da gà, Mỡ cá) unlike wizard's single toggle
- Calorie target editable as fine-tuning affordance, overwritten when goal/aggression/carbSplit changes
- Sidebar updated with "Cài đặt" link pointing to /settings with active state styling
- OnboardingCard on home page for incomplete-onboarding users with 7-day dismiss expiry
- NudgeDialog triggers after 7 days since account creation, capped at 2 dismissals
- All localStorage reads via useEffect + useState for SSR safety — production build passes
- Future trigger hooks documented as TODO comments (Phase 4: after 3rd meal, Phase 7: first dashboard visit)

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings page with full profile editor** - `b21b706` (feat)
2. **Task 2: Onboarding card + nudge dialog + home page integration** - `34517ab` (feat)

## Files Created/Modified
- `app/(app)/settings/page.tsx` — Server component: loads profile, renders ProfileEditor or onboarding link
- `components/onboarding/profile-editor.tsx` — Full-page client form with body metrics, goals, regional, cooking habits (3 fat-trim), portions
- `lib/onboarding/actions.ts` — Added saveProfileSettings server action with typed casts and null guards
- `components/app/main-sidebar.tsx` — Replaced button with Link to /settings, active state, removed ChevronDown
- `components/onboarding/onboarding-card.tsx` — Dismissible card prompting incomplete onboarding with CTA
- `components/onboarding/nudge-dialog.tsx` — Dialog with 7-day trigger and 2-dismiss cap, SSR-safe
- `components/onboarding/onboarding-prompt.tsx` — SSR-safe wrapper managing card dismiss + nudge dialog
- `app/(app)/logging/page.tsx` — Conditionally renders OnboardingPrompt for incomplete profiles

## Decisions Made
- CalorieTarget is editable for fine-tuning but goal/aggression/carbSplit changes always recompute from TDEE (overwrites manual edits) — matches plan spec for clear derivation precedence
- 3 separate fat-trim controls in settings (fatTrimPork, fatTrimChicken, fatTrimFish) since settings gives full per-protein granularity unlike wizard's single toggle that fans out to all 3
- All localStorage reads use useEffect + useState pattern — never reading localStorage at render time or in useState initializer, ensuring SSR safety
- Card dismiss stores timestamp with 7-day expiry; nudge stores dismiss count capped at 2 — different dismiss semantics for different UX goals
- saveProfileSettings never modifies onboardingStep or onboardingCompletedAt — profile editing is independent of wizard progress

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Drizzle decimal column type mismatch**
- **Found during:** Task 1
- **Issue:** weightKg, handSpanCm, knuckleDepthCm are `decimal` columns in Drizzle (mapped to string), but server action was passing numbers
- **Fix:** Used `String()` conversion for decimal columns in saveProfileSettings
- **Files modified:** lib/onboarding/actions.ts
- **Committed in:** b21b706

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential type fix for Drizzle ORM compatibility. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Onboarding) is now complete: all 4 plans executed
- Profile data layer, wizard flow, screens 1-4, settings editor, and nudge system all operational
- Ready for Phase 3 (AI Pipeline) which will consume profile data for cooking adjustments
- Settings page provides post-wizard editing capability per ONB-07

## Self-Check: PASSED

All created files verified:
- `app/(app)/settings/page.tsx` ✅
- `components/onboarding/profile-editor.tsx` ✅
- `components/onboarding/onboarding-card.tsx` ✅
- `components/onboarding/nudge-dialog.tsx` ✅
- `components/onboarding/onboarding-prompt.tsx` ✅

Both task commits verified: b21b706, 34517ab ✅

---
*Phase: 02-onboarding*
*Completed: 2026-03-04*
