# Nutrition Page Design

**Date:** 2026-04-25  
**Status:** Approved for spec review  
**Scope:** Dedicated `/nutrition` page for long-term macro and micronutrient pattern analysis. Excludes supplements, diagnosis, precomputed rollups, live inverse food ranking, custom micronutrient targets, and wearable/lab integrations.

---

## 1. Problem Statement

The current app helps users log meals and see goal progress, but it does not clearly answer:

> What does my diet consistently provide or miss over time?

Weight loss and daily macro adherence matter, but long-term diet quality depends on more than calories. Users should be able to review macro and micronutrient patterns, understand which nutrients are consistently below target, and see when the underlying food data is too incomplete to support a strong conclusion.

The page must be careful with interpretation. It should not diagnose deficiencies or imply disease causation. It should show intake relative to reference targets, explain confidence, and offer practical food-source candidates without supplement recommendations.

---

## 2. Product Positioning

`/dashboard` and `/nutrition` serve different jobs:

| Page | User question | Emphasis |
|------|---------------|----------|
| `/dashboard` | Is my goal plan working? | Today/weekly goal tracking, calories, weight trend, adherence |
| `/nutrition` | What is my dietary pattern over time? | Period averages, consistency, micronutrient adequacy, data confidence |

The nutrition page should frame macros as period-level patterns, not duplicate dashboard daily progress bars.

---

## 3. Route and Navigation

- Add a dedicated app route at `/nutrition`.
- Update the existing sidebar so there is no ambiguous or dead `/tracking` navigation item.
- The current `/tracking` item should be renamed/repointed to Nutrition or replaced by a Nutrition item.
- All user-facing route labels use the existing next-intl message files.

---

## 4. Period Selection

The page supports `7d`, `30d`, and `90d` ranges.

Initial range is data-aware:

| Condition | Initial range |
|-----------|---------------|
| Fewer than 14 logged days in recent history | `7d` |
| 14 or more logged days | `30d` |

`90d` remains available for longer-term review, but is not the default.

---

## 5. Target Semantics

The page displays intake against reference targets, not diagnosis.

### Macronutrients

Macro targets come from the user profile:

- calories
- protein
- carbohydrates
- fat

Fiber is shown as a nutrition-pattern metric when data is available, but it is not currently part of the onboarding macro target model.

### Micronutrients

Micronutrient targets come from a target resolver:

```ts
resolveMicronutrientTargets(profile)
```

The resolver returns:

- nutrient key
- target value
- unit
- target source label
- applicability state

Target source policy:

| User context | Target source |
|--------------|---------------|
| Vietnamese context from onboarding | Vietnam RDA first |
| Non-Vietnamese context | WHO/FAO |
| Missing target or inappropriate scoring | educational/unsupported |

Vietnamese context is determined from onboarding country context. If a user is Vietnamese from onboarding, use Vietnam RDA targets; otherwise use WHO/FAO targets.

The UI must show the target source where relevant, for example “Target: Vietnam RDA” or “Target: WHO/FAO.”

---

## 6. Confidence Semantics

The page separates two questions:

1. How much did the user log for this nutrient?
2. How much should we trust that number?

For each nutrient and selected period, compute calorie-weighted confidence from the user’s actual logged meal items.

### Confidence Formula

For nutrient `n` over period `p`:

```text
confidence(n, p) =
  calories from all meal items with non-null source data for nutrient n
  /
  calories from all meal items in the period
```

The denominator is total calories from all logged meal items in the period, including:

- matched meal items
- unmatched meal items
- meal items without `food_composition_id`
- meal items whose source food has null data for the nutrient

This prevents false high confidence when a large share of the meal has incomplete source data.

Example:

| Item group | Calories | Iron source data |
|------------|----------|------------------|
| Matched items | 500 kcal | present |
| Unmatched items | 300 kcal | absent |

Iron confidence is `500 / 800 = 62.5%`, not `500 / 500 = 100%`.

Return unmatched-calorie metadata separately so the UI can explain why confidence is low.

### Confidence Display Thresholds

| Confidence | Display behavior |
|------------|------------------|
| `>= 70%` | Show number and trend normally; no warning |
| `40–70%` | Show number and trend with “limited data” label |
| `20–40%` | Show number with prominent warning; suppress continuous trend line and show individual daily points |
| `< 20%` | Hide nutrient score/trend and show “insufficient data for this period” |

Confidence affects presentation and summary placement. It does not rewrite the nutrient total.

---

## 7. Nutrient Display Policy

### Default Nutrients

Lead with nutrients that are both meaningful for the product and sufficiently defensible in the current data:

- calcium
- iron
- vitamin C
- phosphorus
- vitamin B1 / thiamin
- vitamin B2 / riboflavin
- vitamin PP / niacin
- beta-carotene / vitamin A context

### Limited or Special Nutrients

- Sodium is shown with source-aware caveats when confidence is low or meals are FAO/Vietnamese-condiment heavy.
- Vitamin D is not treated as a normal food-adequacy score. It appears as an education card.
- Biotin (`vitamin_h_mcg`) is hidden because combined coverage is effectively dead.
- Lower-confidence nutrients appear in an expandable “More nutrients” section when applicable.

### Vitamin D Education Card

Vitamin D content is an i18n-backed message contract, not inline component copy.

Required message concept:

- Vitamin D mainly comes from sunlight, not food.
- Food vitamin D data is limited.
- Food logs do not reflect real vitamin D status.
- If users are concerned, a blood test is the reliable way to know.

Suggested keys:

- `nutrition.education.vitaminD.title`
- `nutrition.education.vitaminD.body`

English and Vietnamese source text must be stored in the existing locale message files.

---

## 8. Page Layout

### 8.1 Header

Content:

- Page title: Nutrition
- Period selector: `7d`, `30d`, `90d`
- Optional subtitle explaining this page analyzes dietary patterns over time

### 8.2 Summary Strip

Summary cards:

| Card | Rule |
|------|------|
| Most consistent | Nutrients at or above target with confidence `>= 40%` |
| Needs attention | Nutrients below target with confidence `>= 40%` |
| Limited data | Nutrients with confidence `< 40%`, including below-target nutrients that cannot safely be called attention items |
| Macro consistency | Optional card showing period macro consistency if space allows |

A nutrient below target with confidence `< 40%` never appears in “Needs attention.” It belongs in “Limited data.”

### 8.3 Macro Pattern Section

This section emphasizes period-level patterns:

- average calories/day
- average protein/day
- average carbohydrates/day
- average fat/day
- average fiber/day where available
- percentage of days near target
- macro distribution over the selected period

Do not use dashboard-style daily bar charts here. Daily progress belongs on `/dashboard`.

### 8.4 Micronutrient Insight Grid

Each nutrient card shows:

- nutrient name
- average intake over selected period
- percent of target
- target source
- confidence label
- confidence-aware visualization
- short caveat when needed

Visualization follows the thresholds in Section 6.

### 8.5 More Nutrients

Expandable section for:

- lower-priority nutrients
- lower-confidence nutrients
- nutrients with caveats

Biotin remains hidden. Vitamin D appears as the education card instead of a score card.

### 8.6 Food-Source Candidates

V1 includes practical food-source candidates, but uses a curated lookup table rather than a live ranked inverse food-composition query.

Rules:

- Trigger only for nutrients below target with confidence `>= 40%`.
- Display as “foods to consider,” not prescriptions.
- No supplement suggestions in v1.
- Use i18n-backed copy.
- Candidate content should be culturally practical for Vietnamese users first.

Implementation contract:

```ts
getFoodSourceCandidates({ nutrient })
```

V1 behavior:

- Reads from a curated nutrient-to-food-source table.
- Returns practical candidates, serving notes, and “why this helps” text.

Future v1.x behavior:

- May augment or replace the curated table with a live ranked query against food composition data.
- Ranking can consider nutrient density, realistic serving size, source/profile relevance, macro/calorie fit, and recent user food context.

The UI should lazy-load candidates only when the user opens the candidates panel so the component contract can support future live ranking without redesign.

---

## 9. Data Flow

### Server Actions

#### `getNutritionOverview(range)`

Responsibilities:

- validate `range`
- authenticate with `requireAuthAndProfile()`
- read user profile and target context
- aggregate selected-period meals and meal items scoped by `user_id`
- compute macro averages and consistency
- compute micronutrient totals and confidence states
- bucket nutrients into summary groups
- return period metadata and display-ready nutrient card data

#### `getFoodSourceCandidates({ nutrient })`

Responsibilities:

- validate nutrient key
- authenticate user
- return curated food-source candidates for v1
- only expose candidates for supported nutrients

### Client Fetching

- Use TanStack Query.
- Overview query key: `['nutrition', 'overview', range]`.
- Candidate query is lazy/enabled only when a user opens a nutrient’s candidates panel.
- Keep calculations server-side; client components render returned display data.

---

## 10. Aggregation and Performance

Avoid N+1 nutrient queries.

The selected-period overview should use a bounded server-side aggregation over meals and meal items, then compute nutrient totals and confidence states in a single pass/pivot-style flow.

Expected v1 row count is small:

```text
3 meals/day × 4 items/meal × 90 days ≈ 1,080 meal_items per user
```

This is acceptable for request-time aggregation.

The current schema already defines `meals_user_logged_at_idx` on `(user_id, logged_at)`, so the action should filter the indexed meal set before joining to meal items.

Do not add a precomputed rollup table in v1. If request-time aggregation becomes slow later, add a daily nutrition rollup table as a v2 optimization.

---

## 11. Loading, Error, and Empty States

| State | Behavior |
|-------|----------|
| Loading | Skeleton cards matching final layout |
| Server/action error | Localized inline error plus sonner toast |
| No meals in selected range | Explain that insights appear after meal logging and link to `/logging` |
| Too few logged days | Show available averages but avoid trend claims |
| Nutrient confidence `< 20%` | Show insufficient-data state instead of score/trend |

All user-facing text must use next-intl messages.

---

## 12. Safety Language

The page must not use:

- “diagnosis”
- “deficiency diagnosis”
- disease claims
- supplement prescriptions
- product recommendations

Allowed framing:

- “below target”
- “above target”
- “adequate”
- “limited data”
- “insufficient data”
- “foods to consider”
- “talk to a clinician”
- “blood test is the reliable way to know” for Vitamin D concerns

---

## 13. Tests

### Target Resolver Tests

Cover:

- Vietnamese onboarding context uses Vietnam RDA targets.
- Non-Vietnam context uses WHO/FAO targets.
- Missing targets return educational/unsupported states.
- Target source labels are returned correctly.

### Confidence Calculation Tests

Cover:

- matched calories with complete nutrient data
- unmatched calories included in denominator
- null source nutrient values
- empty periods
- zero-calorie guards
- threshold boundaries at `70%`, `40%`, and `20%`

### Summary Bucket Tests

Cover:

- below-target and confidence `>= 40%` enters “Needs attention”
- below-target and confidence `< 40%` enters “Limited data”
- above-target and confidence `>= 40%` enters “Most consistent”
- unsupported/educational nutrients do not enter score buckets

### Server Action Tests

Cover:

- auth scoping
- range validation
- aggregation by selected range
- no cross-user meal leakage
- candidate nutrient validation

### Component Tests

Cover:

- range selector
- data-aware initial range
- summary cards
- low-confidence rendering
- Vitamin D education card
- no-meals state
- lazy candidate panel behavior

---

## 14. Out of Scope

- Supplements
- Medical diagnosis or disease prediction
- Live ranked inverse food-source query
- Precomputed daily nutrition rollup table
- Custom micronutrient target editing
- Wearable integrations
- Lab result integrations
- Provider/dietitian dashboard

---

## 15. Open Implementation Notes

- Exact Vietnam RDA and WHO/FAO target values must be captured as data in code with source labels.
- Candidate lookup content should be curated for priority nutrients before implementation is considered complete.
- Existing i18n files must receive all nutrition page labels, caveats, confidence states, and education copy.
