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

Initial range is data-aware and resolved by the overview action when the client passes `range: 'auto'`:

| Condition | Initial range |
|-----------|---------------|
| Fewer than 14 logged days in the last 30 local calendar days | `7d` |
| 14 or more logged days in the last 30 local calendar days | `30d` |

`90d` remains available for longer-term review, but is not the default.

Definition:

- A logged day is a local calendar day with at least one saved meal whose total calories are greater than `0`.
- The client passes the browser `timezoneOffset` to the overview action so day bucketing matches the user’s local date, following the existing meal-history pattern.
- If `timezoneOffset` is unavailable, pass `null`; the server uses UTC and returns metadata indicating UTC bucketing.
- On first render, the client requests `getNutritionOverview({ range: 'auto', timezoneOffset })`; the server returns the resolved range. User-selected ranges then use explicit `7d`, `30d`, or `90d` values.
- Ranges include today. `period.startDate` and `period.endDate` are local `YYYY-MM-DD` dates when `timezoneOffset` is provided, or UTC `YYYY-MM-DD` dates when `timezoneOffset` is `null`.

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

Implementation requirement:

- Create a versioned target data module, for example `lib/nutrition/reference-targets.ts`.
- The module must contain source-labeled Vietnam RDA and WHO/FAO target rows for every scored default nutrient before UI implementation is complete.
- Do not ship placeholder target values. If a value cannot be sourced for a nutrient, mark that nutrient educational/unsupported rather than approximating.
- The first implementation task should populate and test this data module so downstream UI work does not hard-code nutrient targets.

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
| `>= 40%` and `< 70%` | Show number and trend with “limited data” label |
| `>= 20%` and `< 40%` | Show number with prominent warning; suppress continuous trend line and show individual daily points |
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
- vitamin A with beta-carotene context

### Limited or Special Nutrients

- Sodium is shown with source-aware caveats when confidence is low or meals are FAO/Vietnamese-condiment heavy.
- Vitamin A scoring uses `vitamin_a_mcg` only in v1. `beta_carotene_mcg` is shown as contextual supporting data on the Vitamin A card, not converted into Vitamin A equivalents or included in percent-of-target math.
- Vitamin D is not treated as a normal food-adequacy score. It appears as an education card.
- Biotin (`vitamin_h_mcg`) is hidden because combined coverage is effectively dead.
- Lower-confidence nutrients appear in an expandable “More nutrients” section when applicable.

Vitamin A display contract:

- `percentOfTarget` uses only `vitamin_a_mcg`.
- `beta_carotene_mcg` appears in `contextMetrics` as supporting data.
- The card copy must explain that beta-carotene is shown for context and is not converted into the Vitamin A score in v1.

Sodium caveat detection:

Show the sodium caveat if any of these are true in the selected period:

- sodium confidence is `< 70%`
- at least one meal item is matched to an FAO/Vietnamese condiment or sauce food group and that source row has `sodium_mg IS NULL`
- FAO/Vietnamese-source sodium confidence is `< 70%` while FAO/Vietnamese-source items contribute at least `20%` of logged period calories

FAO/Vietnamese-source items are detected by joining through `ingredient_sources` and requiring `ingredient_sources.code = 'FAO_VN_2007'`.

Within FAO/Vietnamese-source items, condiment or sauce foods are detected from the current canonical food-composition group labels:

- `type_en = 'Condiments, traditional sauces'`
- `type_vn = 'Gia vị, nước chấm'`

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
| Macro consistency | Period macro consistency across calories, protein, carbohydrates, and fat |

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

Macro consistency is calculated per logged day:

| Macro | “Near target” rule |
|-------|--------------------|
| Calories | exactly equals the profile calorie target after rounding daily calories to the nearest kcal |
| Protein | at least `90%` of target |
| Carbohydrates | within `±15%` of target |
| Fat | within `±15%` of target |

Each macro gets its own consistency percentage:

```text
days near target for macro / logged calorie-bearing days in range
```

The summary card shows the average of the four macro consistency percentages plus the weakest macro label.

Calories intentionally have no tolerance band. They are either on target or not.

### 8.4 Micronutrient Insight Grid

Each nutrient card shows:

- nutrient name
- average intake over selected period
- percent of target
- target source
- confidence label
- confidence-aware visualization loaded on demand
- short caveat when needed

The initial overview response shows aggregate nutrient status only. Daily trend buckets are fetched lazily when a user expands or otherwise requests the chart for a specific nutrient. Visualization follows the thresholds in Section 6 after the trend data is loaded.

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
- The curated table is a required v1 data artifact, for example `lib/nutrition/food-source-candidates.ts`.
- The table must cover every default scored nutrient that can appear in “Needs attention.”
- Each supported nutrient must have at least five candidates before the candidate panel ships.
- Candidate rows must include nutrient key, localized food name/message keys, serving note, rationale, and optional cautions.
- If curated candidates are missing for a nutrient, the candidate panel is hidden for that nutrient rather than showing placeholder content.

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
- return period metadata and display-ready nutrient card aggregate data
- do not return per-day nutrient trend arrays

Input:

```ts
{
  range: 'auto' | '7d' | '30d' | '90d';
  timezoneOffset: number | null; // minutes, same sign convention as Date#getTimezoneOffset(); null means UTC fallback
}
```

Output DTO shape:

```ts
interface NutritionOverview {
  requestedRange: 'auto' | '7d' | '30d' | '90d';
  resolvedRange: '7d' | '30d' | '90d';
  bucketTimezone: 'local' | 'utc';
  loggedDays: number;
  loggedDaysLast30: number;
  trendStatus: 'ready' | 'too_few_logged_days';
  period: { startDate: string; endDate: string };
  summary: {
    mostConsistent: NutrientSummaryItem[];
    needsAttention: NutrientSummaryItem[];
    limitedDataCount: number;
    macroConsistency: MacroConsistencySummary;
  };
  macros: MacroPattern[];
  micronutrients: NutrientCardData[];
  moreNutrients: NutrientCardData[];
  educationCards: EducationCardData[];
}
```

Referenced DTOs:

```ts
interface NutrientSummaryItem {
  nutrient: string;
  labelKey: string;
  average: number;
  unit: string;
  percentOfTarget: number | null;
  confidence: number;
  status: 'below_target' | 'adequate' | 'above_target' | 'limited_data';
}

interface MacroConsistencySummary {
  averageConsistencyPct: number;
  weakestMacro: 'calories' | 'protein' | 'carbohydrate' | 'fat' | null;
}

interface MacroPattern {
  key: 'calories' | 'protein' | 'carbohydrate' | 'fat' | 'fiber';
  labelKey: string;
  averagePerDay: number;
  target: number | null;
  unit: string;
  consistencyPct: number | null;
}

interface NutrientCardData {
  nutrient: string;
  labelKey: string;
  group: 'mineral' | 'vitamin' | 'other';
  averagePerDay: number | null;
  target: number | null;
  targetSource: 'vietnam_rda' | 'who_fao' | 'unsupported';
  unit: string;
  percentOfTarget: number | null;
  confidence: number;
  displayState:
    | 'normal'
    | 'limited_data'
    | 'warning_points'
    | 'insufficient_data';
  caveatKey?: string;
  contextMetrics?: {
    key: string;
    labelKey: string;
    averagePerDay: number | null;
    unit: string;
  }[];
  sourceBreakdown?: {
    faoVietnamCalorieShare: number;
    faoVietnamConfidence: number | null;
    missingSodiumCondimentItems?: number;
  };
  supportsCandidates: boolean;
}

interface EducationCardData {
  id: 'vitamin_d';
  titleKey: string;
  bodyKey: string;
}
```

#### `getNutrientTrend({ nutrient, range, timezoneOffset })`

Responsibilities:

- validate nutrient key
- validate range
- authenticate user
- bucket one nutrient by local day for the selected range
- return confidence-aware daily points for chart rendering

Input:

```ts
{
  nutrient: string;
  range: '7d' | '30d' | '90d';
  timezoneOffset: number | null;
}
```

Output DTO shape:

```ts
interface NutrientTrend {
  nutrient: string;
  range: '7d' | '30d' | '90d';
  bucketTimezone: 'local' | 'utc';
  displayMode: 'line' | 'points' | 'insufficient_data';
  points: {
    date: string;
    value: number | null;
    confidence: number;
  }[];
}
```

#### `getFoodSourceCandidates({ nutrient })`

Responsibilities:

- validate nutrient key
- authenticate user
- return curated food-source candidates for v1
- only expose candidates for supported nutrients

Input:

```ts
{
  nutrient: SupportedCandidateNutrient;
}
```

Output DTO shape:

```ts
interface FoodSourceCandidates {
  nutrient: SupportedCandidateNutrient;
  candidates: {
    id: string;
    nameKey: string;
    servingKey: string;
    rationaleKey: string;
    cautionKey?: string;
  }[];
}
```

### Client Fetching

- Use TanStack Query.
- Overview query key: `['nutrition', 'overview', range, timezoneOffset ?? 'utc']`.
- Candidate query is lazy/enabled only when a user opens a nutrient’s candidates panel.
- Nutrient trend query key: `['nutrition', 'trend', nutrient, resolvedRange, timezoneOffset ?? 'utc']`.
- Nutrient trend query is lazy/enabled only when a nutrient card is expanded or otherwise requests the chart.
- Keep calculations server-side; client components render returned display data.

---

## 10. Aggregation and Performance

Avoid N+1 nutrient queries.

The selected-period overview should use a bounded server-side aggregation over meals and meal items, then compute nutrient totals and confidence states in a single pass/pivot-style flow.

`getNutritionOverview` returns aggregates only. It must not include daily trend arrays for all nutrients. Daily buckets are fetched by `getNutrientTrend` one nutrient at a time.

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

Too-few-logged-days thresholds:

| Resolved range | Trend-ready threshold |
|----------------|-----------------------|
| `7d` | at least 3 logged days |
| `30d` | at least 10 logged days |
| `90d` | at least 30 logged days |

If the selected range is below its threshold, `trendStatus` is `too_few_logged_days`; the UI may show averages and nutrient cards, but must avoid trend claims in summary copy.

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

### Macro Consistency Tests

Cover:

- calorie consistency passes when rounded daily calories exactly equal the profile calorie target
- calorie consistency fails when rounded daily calories differ from target by one kcal
- no calorie `±10%` tolerance is applied
- protein, carbohydrates, and fat use their defined non-calorie thresholds

### Server Action Tests

Cover:

- auth scoping
- range validation
- aggregation by selected range
- no cross-user meal leakage
- candidate nutrient validation
- nutrient trend action validates one nutrient/range at a time
- overview action does not return all nutrient daily trend arrays

### Component Tests

Cover:

- range selector
- data-aware initial range
- summary cards
- low-confidence rendering
- Vitamin D education card
- no-meals state
- lazy candidate panel behavior
- lazy nutrient trend loading when a card is expanded
- hidden `moreNutrients` cards do not trigger trend queries until expanded or requested

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

## 15. Implementation Requirements

- Exact Vietnam RDA and WHO/FAO target values must be captured as data in code with source labels.
- Candidate lookup content should be curated for priority nutrients before implementation is considered complete.
- Existing i18n files must receive all nutrition page labels, caveats, confidence states, and education copy.
- Do not implement UI placeholders for missing target values or missing food-source candidates.
- Complete reference target data and curated candidate data before wiring final UI states.
