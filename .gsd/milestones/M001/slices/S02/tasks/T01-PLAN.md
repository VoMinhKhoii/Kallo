# T01: 02-onboarding 01

**Slice:** S02 — **Milestone:** M001

## Description

Create the foundational data layer for onboarding: schema columns for new fields (hand measurements, carb split preference, onboarding progress tracking) and a pure TDEE calculation engine with types, constants, Zod schemas, and regional cooking defaults.

Purpose: Everything in the onboarding wizard depends on these — the TDEE module drives Screen 1's live calculations, the types/schemas validate all form inputs, the constants define the domain rules (WIZARD_DEFAULTS for form initialization, SKIP_FALLBACK_DEFAULTS for DB writes when user skips Screen 4), and the schema columns store the results.
Output: Drizzle migration for 5 new columns + complete `lib/onboarding/` module with tested TDEE functions.

## Must-Haves

- [ ] "Mifflin-St Jeor BMR calculation returns correct values for male and female inputs"
- [ ] "TDEE = BMR × activity multiplier for all 4 activity levels"
- [ ] "Macro grams computed correctly from calorie target using 3 carb split ratios (4 cal/g protein, 4 cal/g carb, 9 cal/g fat)"
- [ ] "Aggression presets produce correct daily kcal deficit/surplus (275/550/825)"
- [ ] "deficitOverride overrides aggression preset when provided in calcDailyTargets"
- [ ] "goalSchema rejects { goal: 'cutting', aggression: null } with error on aggression path"
- [ ] "Schema accepts hand_span_cm, knuckle_depth_cm, carb_split, onboarding_step, onboarding_completed_at columns"

## Files

- `lib/db/schema.ts`
- `supabase/migrations/NEW_add_onboarding_columns.sql`
- `lib/onboarding/tdee.ts`
- `lib/onboarding/types.ts`
- `lib/onboarding/constants.ts`
- `lib/onboarding/schemas.ts`
- `lib/onboarding/__tests__/tdee.test.ts`
