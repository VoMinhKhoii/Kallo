# Dashboard Data Wiring & i18n Design

**Date:** 2026-04-20
**Status:** Draft
**Scope:** Replace all hardcoded mock data with real DB queries; complete i18n for all dashboard components. Excludes weight logging (WeightCard submit).

---

## 1. Overview

The dashboard is fully built visually but every data point comes from `mock-data.ts`. This spec covers wiring each dashboard section to real Supabase data via server actions, completing i18n for all hardcoded strings, and organizing the work into three independent git worktrees split by dashboard section.

### Worktree Split

| Worktree | Branch | Sections |
|----------|--------|----------|
| 1 | `feat/dashboard-current-section` | PaceCard, DeficitCard, ProteinConsistencyCard, CaloriesRemaining KPI |
| 2 | `feat/dashboard-progress-section` | WeightChart, AdherenceHeatmap |
| 3 | `feat/dashboard-today-section` | TodaySection, MealList, CalorieRing, MacroBars |

Each worktree includes: server action, component data wiring, i18n keys (en + vi), and DashboardShell cleanup for its queries.

---

## 2. Architecture: Decentralized Data Fetching

**Decision:** Each section component owns its own `useQuery → server action` call. DashboardShell only manages `timeRange` state and layout.

**Rationale:**
- Next.js recommends parallel Suspense streaming for independent dashboard sections
- TanStack Query best practice: colocate queries with components that consume them
- Keeps worktrees fully independent (no shared DashboardShell data-layer modifications that conflict)

### Data Flow

```
DashboardShell (timeRange state + layout)
├── CurrentSection
│   └── useQuery('dashboard-current') → getCurrentSectionData()
├── ProgressSection (receives timeRange prop)
│   └── useQuery('dashboard-progress', timeRange) → getProgressData(timeRange)
└── TodaySection
    └── useQuery('dashboard-today') → getTodayData()
```

TanStack Query automatically parallelizes queries in separate components rendered in the same cycle.

---

## 3. Server Actions

All server actions live in `lib/dashboard/actions/`. Each uses `requireAuthAndProfile()` from `lib/auth.ts` for auth + profile targets. Server-side Drizzle uses direct postgres via DATABASE_URL — queries are explicitly scoped by `user_id` (no RLS).

### 3.1 `getCurrentSectionData()` — `lib/dashboard/actions/current.ts`

**Returns:** `{ verdict: VerdictData, stats: StatsData, caloriesRemaining: number, calorieTarget: number }`

**Queries:**
- `bodyWeightLog` (latest 14 entries, ordered by date DESC):
  - Rolling average: mean of last 7 entries vs mean of prior 7 entries
  - `weeklyRate`: difference of the two averages
  - `currentWeight`: most recent entry
- `bodyWeightLog` (first entry ever):
  - `totalDelta`: currentWeight − firstWeight
- `meals` (current Mon–Sun week):
  - Daily calorie sums → `avgDeficit = calorieTarget − mean(dailySums)`
  - Daily protein sums → `proteinDays[7]`: array of booleans (met target or not)
- `meals` (today):
  - Sum calories → `caloriesRemaining = calorieTarget − todayCalories`

**PaceStatus logic:**
- `too_early`: fewer than 2 weight entries total
- `on_pace`: weeklyRate within ±20% of expected rate (derived from goal + aggression)
- `ahead`: weeklyRate exceeds expected by >20%
- `behind`: weeklyRate below expected by >20%

**Notes:**
- `streak` field removed (dead — nothing in UI reads it)
- `daysLogged`, `todayWeight`, `weightPlaceholder` still computed (WeightCard display reads them)

### 3.2 `getProgressData(timeRange)` — `lib/dashboard/actions/progress.ts`

**Params:** `timeRange: '30d' | '90d'`

**Returns:** `{ weightData: number[], weightChartMeta: WeightChartMeta, heatmapData: (number | null)[][] }`

**Queries:**
- `bodyWeightLog` (ordered by date, filtered to range) → `weightData[]`
- `userProfiles.goal` → `goalDirection` ('down' for cutting, 'up' for bulking)
- `meals` (daily calorie sums for range):
  - Adherence ratio per day: `actual / target` (captures both overshoot and undershoot)
  - Days organized into weeks (Mon–Sun), transposed to 7 rows × N columns
  - Unlogged days = `null`

**Heatmap data shape:** 7 rows (Monday → Sunday) × N columns (weeks). Each cell is adherence ratio (0–2+ range) or `null`.

### 3.3 `getTodayData()` — `lib/dashboard/actions/today.ts`

**Returns:** `{ nutrition: NutritionData, meals: MealEntry[] }`

**Queries:**
- `meals` (today, ordered by `loggedAt`):
  - `MealEntry[]`: `{ id, label (rawInput), calories }` — maps DB `calories_kcal` → `calories` to match existing `MealEntry` type
  - Sum today's calories/protein/carbs/fat → `NutritionData` with profile targets

---

## 4. i18n Strategy

### Hierarchy

All dashboard keys follow: `dashboard → section → component → field`

```
dashboard.weekTitle
dashboard.fetchError

dashboard.current.caloriesRemaining
dashboard.current.paceCard.title
dashboard.current.paceCard.kgPerWeek
dashboard.current.paceCard.onPace
dashboard.current.paceCard.ahead
dashboard.current.paceCard.behind
dashboard.current.paceCard.tooEarly
dashboard.current.paceCard.since
dashboard.current.paceCard.totalDelta
dashboard.current.deficitCard.title
dashboard.current.deficitCard.kcalPerDay
dashboard.current.deficitCard.target
dashboard.current.proteinCard.daysCount
dashboard.current.proteinCard.mon
dashboard.current.proteinCard.tue
dashboard.current.proteinCard.wed
dashboard.current.proteinCard.thu
dashboard.current.proteinCard.fri
dashboard.current.proteinCard.sat
dashboard.current.proteinCard.sun

dashboard.progress.title
dashboard.progress.weightTrend
dashboard.progress.timeRange.30d
dashboard.progress.timeRange.90d
dashboard.progress.weightChart.notEnoughData
dashboard.progress.weightChart.offTrack
dashboard.progress.adherenceHeatmap.title
dashboard.progress.adherenceHeatmap.noData
dashboard.progress.adherenceHeatmap.onTarget
dashboard.progress.adherenceHeatmap.close
dashboard.progress.adherenceHeatmap.slightlyOver
dashboard.progress.adherenceHeatmap.slightlyUnder
dashboard.progress.adherenceHeatmap.over
dashboard.progress.adherenceHeatmap.under
dashboard.progress.adherenceHeatmap.farOver
dashboard.progress.adherenceHeatmap.farUnder
dashboard.progress.adherenceHeatmap.mon
dashboard.progress.adherenceHeatmap.tue
dashboard.progress.adherenceHeatmap.wed
dashboard.progress.adherenceHeatmap.thu
dashboard.progress.adherenceHeatmap.fri
dashboard.progress.adherenceHeatmap.sat
dashboard.progress.adherenceHeatmap.sun

dashboard.today.title
dashboard.today.mealList.recentMeals
dashboard.today.mealList.logged
dashboard.today.mealList.noMealsToday
dashboard.today.protein
dashboard.today.carbs
dashboard.today.fat
```

### Migration of Existing Keys

Existing flat keys are restructured:
- `dashboard.progress` → `dashboard.progress.title`
- `dashboard.today` → `dashboard.today.title`
- `dashboard.caloriesRemaining` → `dashboard.current.caloriesRemaining`
- `dashboard.adherenceHeatmap.*` → `dashboard.progress.adherenceHeatmap.*`

Each worktree handles its own key migrations to avoid merge conflicts.

---

## 5. Component Changes per Worktree

### Worktree 1 — `feat/dashboard-current-section`

| File | Change |
|------|--------|
| `lib/dashboard/actions/current.ts` | **New** — server action |
| `components/dashboard/current/current-section.tsx` | Add `useQuery → getCurrentSectionData()`, remove data props |
| `components/dashboard/current/pace-deficit-card.tsx` | i18n all hardcoded strings; DeficitCard "Target: ~500 kcal/day" replaced with actual profile target from server action data |
| `components/dashboard/current/protein-consistency-card.tsx` | i18n day labels + count string |
| `components/dashboard/dashboard-shell.tsx` | Remove verdict/stats/nutrition queries, simplify CurrentSection call |
| `components/dashboard/types.ts` | Remove `streak` from `StatsData` |
| `messages/en.json` | Add `dashboard.current.*` keys |
| `messages/vi.json` | Add Vietnamese translations |

### Worktree 2 — `feat/dashboard-progress-section`

| File | Change |
|------|--------|
| `lib/dashboard/actions/progress.ts` | **New** — server action |
| `components/dashboard/progress/progress-section.tsx` | Add `useQuery → getProgressData(timeRange)`, absorb time-range toggle + "Progress" header from DashboardShell, own WeightChart/Heatmap rendering internally (no longer render props) |
| `components/dashboard/progress/weight-chart.tsx` | i18n hardcoded strings |
| `components/dashboard/progress/adherence-heatmap.tsx` | i18n day labels, restructure key namespace |
| `components/dashboard/dashboard-shell.tsx` | Remove weight/chart/heatmap queries, remove progress header/toggle UI (moves into ProgressSection), pass timeRange + onTimeRangeChange to ProgressSection |
| `messages/en.json` | Add `dashboard.progress.*`, move adherenceHeatmap keys |
| `messages/vi.json` | Add Vietnamese translations |

### Worktree 3 — `feat/dashboard-today-section`

| File | Change |
|------|--------|
| `lib/dashboard/actions/today.ts` | **New** — server action |
| `components/dashboard/today/today-section.tsx` | Add `useQuery → getTodayData()`, remove data props |
| `components/dashboard/today/meal-list.tsx` | i18n count string |
| `components/dashboard/dashboard-shell.tsx` | Remove nutrition/meals queries, simplify TodaySection call |
| `messages/en.json` | Add `dashboard.today.*` keys |
| `messages/vi.json` | Add Vietnamese translations |

### DashboardShell Final State (after all 3 merges)

```tsx
// Only manages timeRange + layout — zero data fetching
const [timeRange, setTimeRange] = useState<TimeRange>('30d');

return (
  <div>
    <Header weekTitle={getWeekTitle(t)} />
    <CurrentSection />
    <ProgressSection timeRange={timeRange} onTimeRangeChange={setTimeRange} />
    <TodaySection />
    <MealTrigger />
  </div>
);
```

`mock-data.ts` becomes dead code after all 3 worktrees merge — deleted in cleanup.

---

## 6. Error Handling & Loading States

### Fetch Errors
- `useQuery` `onError` callback → `toast.error(t('dashboard.fetchError'))` via sonner
- TanStack Query retries 3× before surfacing the error
- Component shows last cached data if available, skeleton if first load

### Query Configuration
- All dashboard queries use `staleTime: 60_000` (60s) — prevents unnecessary refetches on tab switches while keeping data reasonably fresh
- `refetchOnWindowFocus: true` (TanStack Query default) — refreshes on tab return after staleTime

### Loading States
- Each section renders its own skeleton (shimmer placeholders matching card shapes)
- No shared loading spinner

### Empty States (inline, not errors)
- WeightChart: "Not enough data yet" when < 2 entries
- Heatmap: empty grid with null cells
- MealList: "No meals today" message
- PaceCard: "Too early" status when < 2 weight entries

---

## 7. Testing

- **Server actions:** Vitest unit tests mocking Drizzle queries — verify correct SQL construction, auth enforcement, date math, edge cases (no data, single entry, boundary dates)
- **Components:** No new component tests (existing pattern — components are thin UI wrappers over data)
- **Manual QA:** After each worktree, verify with real data via `bun dev`

---

## 8. Out of Scope

- Weight logging (WeightCard submit flow)
- MealTrigger (already fully functional + i18n'd)
- Shared components in `components/shared/` (CalorieRing, MacroBars — already data-driven via props)
- Dashboard redesign / layout changes
- New features not currently in the UI
- `getWeekTitle()` date formatting — currently hardcodes `en-US` locale; kept as-is for now (cosmetic, not functional)

## 9. Post-Merge Cleanup

After all 3 worktrees merge to main:
- Delete `components/dashboard/mock-data.ts` (dead code)
- Remove `streak` from `StatsData` if not already done in Worktree 1
- Verify no remaining imports of mock functions
