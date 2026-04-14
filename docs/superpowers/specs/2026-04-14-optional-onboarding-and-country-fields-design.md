# Optional Onboarding & Country-Based Profiling

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** Auth gate, DB schema, onboarding wizard, pipeline prompts, settings page

---

## Problem

The current onboarding flow has three issues:

1. **Mandatory fields block logging.** `lib/auth.ts` and `lib/ai/actions.ts` require `goal` and `regionalProfile` before a user can analyze meals. Many users want to log immediately.
2. **Vietnamese-specific regional profile is too narrow.** The 4-region picker (miền Bắc/Trung/Nam/Tây) only works for Vietnamese users in Vietnam. It doesn't help diaspora users or users from other food cultures.
3. **Hand span and knuckle depth are unused.** These fields are collected but never consumed by the pipeline.

## Solution

1. Make all onboarding fields optional — pipeline uses sensible defaults when data is missing.
2. Replace the Vietnamese regional profile with two country-level fields: **country of origin** (food culture signal) and **country of residence** (ingredient availability signal).
3. Remove hand span and knuckle depth from the schema entirely.

---

## 1. Database Schema Changes

### New Columns (`user_profiles`)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `country_of_origin` | `TEXT` | Yes | English country name, e.g., "Vietnam", "Korea" |
| `country_of_residence` | `TEXT` | Yes | English country name |

### Dropped Columns

| Column | Reason |
|--------|--------|
| `regional_profile` | Replaced by `country_of_origin` |
| `hand_span_cm` | Unused by pipeline |
| `knuckle_depth_cm` | Unused by pipeline |

### Dropped CHECK Constraints

- `user_profiles_regional_profile_check`
- `user_profiles_hand_span_cm_check`
- `user_profiles_knuckle_depth_cm_check`

### Updated CHECK Constraint

- `user_profiles_onboarding_step_check`: `onboarding_step >= 0 AND onboarding_step <= 3` (was 5)

### Migration Strategy

Single Drizzle migration:
1. **Data migration first:** `UPDATE user_profiles SET onboarding_step = 3 WHERE onboarding_step > 3;` — existing users may have step 4 or 5, which would violate the new constraint.
2. Add `country_of_origin` and `country_of_residence` columns.
3. Drop `regional_profile`, `hand_span_cm`, `knuckle_depth_cm` columns (and their constraints).
4. Update onboarding step constraint.

Existing `regional_profile` data will be lost. This is acceptable — the field is being replaced, not evolved.

**Note:** `bowl_size_ml` and `plate_size_ml` columns are retained intentionally despite `screen-portions.tsx` being deleted. They still have defaults (200/400) and may be used in future portion estimation features.

---

## 2. Auth Gate Changes

### `lib/auth.ts` — `requireAuthAndProfile()`

**Before:** Throws `Errors.onboardingIncomplete()` if `!profile?.goal || !profile?.regionalProfile`.

**After:** Only checks that a profile row exists. No field-level validation. The pipeline handles missing data.

```typescript
const profile = rows[0];
if (!profile) {
  throw Errors.onboardingIncomplete();
}
```

### `lib/ai/actions.ts` — `analyzeMealAction()`

**Before:** Returns error if `!profile?.goal || !profile?.regionalProfile`.

**After:** Only checks profile row exists. `buildUserContext()` handles null fields.

### `app/api/analyze-meal/route.ts` — SSE streaming endpoint

**Before:** Line 59 has the same `!profile?.goal || !profile?.regionalProfile` gate.

**After:** Same fix — only check profile row exists.

---

## 3. Pipeline Changes

### `UserContext` Type (`lib/ai/types.ts`)

```typescript
interface UserContext {
  goal: Goal;
  aggression: number;
  countryOfOrigin: string | null;     // replaces regionalProfile
  countryOfResidence: string | null;   // new
  cookingHabits: CookingHabits;
}
```

### `buildUserContext()` (`lib/ai/mappers.ts`)

Maps null profile fields to sensible defaults:

| Field | Null Default | Rationale |
|-------|-------------|-----------|
| `goal` | `'maintaining'` | No caloric adjustment — safest |
| `aggression` | `0` | No deficit/surplus |
| `countryOfOrigin` | `null` | LLM uses generic assumptions |
| `countryOfResidence` | `null` | LLM uses generic assumptions |
| `oilUsage` | `'normal'` | Neutral midpoint |
| `defaultRicePortion` | `'medium'` | Neutral midpoint |
| `sugarBraised` | `'medium'` | Neutral midpoint |
| `defaultProteinPortion` | `'medium'` | Neutral midpoint |
| `brothConsumption` | `'some'` | Neutral midpoint |

### Decomposition Prompt (`lib/ai/prompts/decomposition.ts`)

**Removed:** `regionDescriptions` map, `<regional_priors>` section.

**Added:** Country context lines in `<user_context>`:

```xml
<user_context>
  country_of_origin: Vietnam
  country_of_residence: Australia
  oil_usage: normal
  ...
</user_context>
```

When a country field is null, that line is omitted from the prompt. The LLM handles missing context gracefully.

### Nutrition Prompt (`lib/ai/prompts/nutrition.ts`)

Same change — add country context lines to `<user_context>` for consistency. Cooking habits remain structured.

### Why These Two Fields Improve Pipeline Accuracy

**Country of origin → food culture priors.** When the LLM knows the user is from Vietnam, it infers Vietnamese cooking patterns (phở seasoning, cơm nhà structure, typical sugar levels) even without explicit cooking habit data. For a Korean user logging "rice + meat," the LLM applies different seasoning and portion assumptions. This leverages the LLM's world knowledge about national cuisines — a stronger signal than the old 4-region lookup.

**Country of residence → ingredient & portion context.** A Vietnamese person in the US likely encounters American serving sizes and supermarket cuts. "200g chicken thigh" from an Australian user is standard; from a user in Vietnam, it's a large serving. Protein cuts, oil types, and even rice varieties differ by country. This field provides genuinely new signal that the old system lacked entirely.

---

## 4. Onboarding Wizard Changes

### New 3-Screen Flow

| Screen | Content | Skippable? |
|--------|---------|------------|
| **1** | Body metrics + goals | Yes — all null/defaults |
| **2** | Origin & Residence | Yes — both null |
| **3** | Cooking habits | Yes — neutral defaults |

All screens are fully skippable. The wizard itself is dismissible. The sidebar OnboardingCard and NudgeDialog continue to remind users to fill in their profile.

### Screen 2: Origin & Residence (new)

Two searchable comboboxes (shadcn `Command`-based):
- **Where are you from?** — full ISO country list with text search
- **Where do you live now?** — full ISO country list with text search

Both fields are optional. No pre-selection. Users search by typing (e.g., "Viet" → "Vietnam").

### Constants Changes

- `ONBOARDING_REQUIRED_STEP`: 4 → 3
- `TOTAL_STEPS` in wizard: 4 → 3
- **Remove:** `REGIONAL_COOKING_DEFAULTS` map (cooking habits decoupled from region)
- **Remove:** `SKIP_FALLBACK_DEFAULTS` (hand span/knuckle)
- **Remove:** `WIZARD_DEFAULTS.handSpanCm`, `WIZARD_DEFAULTS.knuckleDepthCm`

### Files to Create

| File | Purpose |
|------|---------|
| `components/onboarding/screen-origin.tsx` | New Screen 2: country comboboxes |

### Files to Delete

| File | Reason |
|------|--------|
| `components/onboarding/screen-regional.tsx` | Replaced by screen-origin |
| `components/onboarding/screen-portions.tsx` | Hand measurements removed |
| `components/settings/profile/portions.tsx` | Hand measurements removed |

### Files to Modify

| File | Change |
|------|--------|
| `lib/db/schema.ts` | Add/drop columns, update constraints |
| `lib/auth.ts` | Remove field-level check |
| `lib/ai/actions.ts` | Remove field-level check |
| `app/api/analyze-meal/route.ts` | Remove field-level check (same gate as actions.ts) |
| `lib/ai/types.ts` | Update `UserContext` interface |
| `lib/ai/mappers.ts` | Update `buildUserContext()` |
| `lib/ai/prompts/decomposition.ts` | Replace regional priors with country context |
| `lib/ai/prompts/nutrition.ts` | Add country context to user_context |
| `lib/onboarding/types.ts` | Remove `RegionalProfile`, `OnboardingProfile` updates |
| `lib/onboarding/schemas.ts` | Remove `regionalProfileSchema`, add country schemas |
| `lib/onboarding/constants.ts` | Remove regional defaults, hand defaults |
| `lib/onboarding/actions.ts` | Update step mapping, remove hand/regional logic |
| `components/onboarding/wizard-shell.tsx` | 3 screens, remove portions/regional |
| `components/onboarding/screen-cooking.tsx` | Remove `regionalProfile` prop |
| `components/settings/profile/regional.tsx` | Replace with origin/residence fields |
| `components/settings/profile/index.tsx` | Update imports/composition |

### Tests to Update

| File | Change |
|------|--------|
| `lib/auth.test.ts` | Update gate logic tests |
| `lib/ai/pipeline/prompts.test.ts` | Update prompt assertion tests |
| `lib/ai/pipeline/logging.test.ts` | Update UserContext fixtures |
| `lib/ai/__tests__/pipeline.test.ts` | Update UserContext fixtures |
| `lib/ai/prompts/__tests__/nutrition.test.ts` | Update prompt assertions |
| `app/api/analyze-meal/__tests__/route.test.ts` | Update UserContext fixtures, remove regionalProfile references |

---

## 5. Settings Page Changes

- `components/settings/profile/regional.tsx` → rewritten to show origin/residence comboboxes
- `components/settings/profile/portions.tsx` → deleted
- `components/settings/profile/index.tsx` → updated to remove portions section, update regional section
- `lib/onboarding/actions.ts` `saveProfileSettings()` → remove hand/regional fields, add country fields

---

## 6. Edge Cases & Considerations

1. **Existing users with `regional_profile` data:** The migration drops the column. Users lose their regional selection but keep their cooking habits (which were the actionable data anyway). They'll see empty origin/residence fields in settings.

2. **Pipeline with completely empty profile:** Works fine — `maintaining` goal + neutral cooking habits + no country context. The LLM produces reasonable generic Vietnamese estimates since the food DB is Vietnamese.

3. **Non-Vietnamese users:** The pipeline will work but produce lower-confidence estimates since the food DB is Vietnamese-only. Country of origin helps the LLM adjust expectations (e.g., for a Korean user, the LLM won't assume Vietnamese seasonings).

4. **Country data format:** Stored as plain text country names (not ISO codes). The combobox displays and stores the English country name. This is simpler than ISO codes and works directly in LLM prompts.
