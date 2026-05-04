# Dashboard Structure Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard into a responsive daily cockpit where calories, meals, weight progress, and adherence history read as one connected surface.

**Architecture:** Keep the existing dashboard data sources and split UI responsibilities into focused units: Today Dock, Progress Story, and Consistency Heatmap. Add small pure helpers for heatmap range adaptation and weight trend summaries so behavior is testable without rendering the full dashboard. DashboardShell coordinates layout and range state only.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, next-intl, Recharts, Motion, Tailwind CSS 4, Vitest, Testing Library, Biome.

---

## Chunk 1: Data Models and Pure Dashboard Helpers

### Files and responsibilities

- Modify: `lib/types/dashboard.ts` — add explicit heatmap range/cell/header types and keep weight range separate from heatmap range.
- Modify: `lib/dashboard/adherence.ts` — add `year` support, date-aware cell output, and month header construction while preserving current ratio matrix compatibility until UI migration is complete.
- Modify: `lib/dashboard/__tests__/adherence.test.ts` — test year cells, future cells, month headers, and adaptive range selection.
- Create: `lib/dashboard/heatmap-range.ts` — pure helper for choosing `renderedHeatmapRange`.
- Create: `lib/dashboard/weight-trend.ts` — pure helper for Progress Story summary and verdict copy keys.
- Create: `lib/dashboard/__tests__/weight-trend.test.ts` — test insufficient data, on pace, ahead, behind, flat, and small-rate tolerance.
- Modify: `lib/types/weight.ts` — add optional elapsed-day metadata for projection.
- Modify: `lib/actions/weight.ts` — populate elapsed-day metadata from first/latest logged dates in the selected range.
- Modify: `lib/actions/__tests__/weight.test.ts` — verify elapsed-day metadata from mocked weight rows.

### Task 1: Add heatmap range and cell types

**Files:**
- Modify: `lib/types/dashboard.ts`

- [ ] **Step 1: Add explicit heatmap types**

Add these types near `TimeRange`:

```ts
export type WeightRange = '30d' | '90d';
export type HeatmapRange = '30d' | '90d' | 'year';
export type HeatmapCellStatus = 'logged' | 'unlogged' | 'future' | 'outside';

export interface HeatmapCell {
  date: string;
  ratio: number | null;
  status: HeatmapCellStatus;
}

export interface HeatmapMonthHeader {
  month: string;
  startColumn: number;
  span: number;
}

export interface HeatmapData {
  cells: HeatmapCell[][];
  monthHeaders: HeatmapMonthHeader[];
}
```

- [ ] **Step 2: Keep compatibility alias temporarily**

Keep the current `TimeRange` export as:

```ts
export type TimeRange = WeightRange;
```

Expected: existing dashboard code still compiles while new heatmap code can use `HeatmapRange`.

- [ ] **Step 3: Run type-adjacent tests**

Run: `bun run test lib/dashboard/__tests__/adherence.test.ts`

Expected: existing adherence tests still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/types/dashboard.ts
git commit -m "feat: add dashboard heatmap range types"
```

### Task 2: Test and implement date-aware heatmap data

**Files:**
- Modify: `lib/dashboard/adherence.ts`
- Modify: `lib/dashboard/__tests__/adherence.test.ts`

- [ ] **Step 1: Write failing tests for year cells and future status**

Add tests that call a new `buildCalorieAdherenceHeatmapData` helper:

```ts
it('builds current-year cells and marks future dates separately', () => {
  const heatmap = buildCalorieAdherenceHeatmapData({
    range: 'year',
    timezoneOffset: 0,
    calorieTarget: 2000,
    now: new Date('2026-04-23T12:00:00.000Z'),
    dailyCalories: [{ date: '2026-04-22', calories: 1800 }],
  });

  expect(heatmap.cells).toHaveLength(7);
  expect(heatmap.cells[0].length).toBeGreaterThanOrEqual(52);

  const logged = heatmap.cells.flat().find((cell) => cell.date === '2026-04-22');
  expect(logged).toMatchObject({ ratio: 0.9, status: 'logged' });

  const future = heatmap.cells.flat().find((cell) => cell.date === '2026-12-31');
  expect(future).toMatchObject({ ratio: null, status: 'future' });

  const outside = heatmap.cells.flat().find((cell) => cell.date === '2025-12-29');
  expect(outside).toMatchObject({ ratio: null, status: 'outside' });
});
```

- [ ] **Step 2: Write failing test for month headers**

```ts
it('builds month headers aligned to week columns', () => {
  const heatmap = buildCalorieAdherenceHeatmapData({
    range: 'year',
    timezoneOffset: 0,
    calorieTarget: 2000,
    now: new Date('2026-04-23T12:00:00.000Z'),
    dailyCalories: [],
  });

  expect(heatmap.monthHeaders[0]).toEqual({
    month: 'Jan',
    startColumn: 0,
    span: 5,
  });
  expect(heatmap.monthHeaders.find((header) => header.month === 'Apr')).toEqual({
    month: 'Apr',
    startColumn: 13,
    span: 5,
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `bun run test lib/dashboard/__tests__/adherence.test.ts`

Expected: FAIL because `buildCalorieAdherenceHeatmapData` does not exist.

- [ ] **Step 4: Implement `DashboardHeatmapRange` support**

In `lib/dashboard/adherence.ts`:

```ts
export type DashboardHeatmapRange = '30d' | '90d' | 'year';

const RANGE_DAYS: Record<Exclude<DashboardHeatmapRange, 'year'>, number> = {
  '30d': 30,
  '90d': 90,
};
```

Add helpers:

```ts
function startOfLocalYear(endKey: string): Date {
  const year = Number(endKey.slice(0, 4));
  return new Date(Date.UTC(year, 0, 1));
}

function endOfLocalYear(endKey: string): Date {
  const year = Number(endKey.slice(0, 4));
  return new Date(Date.UTC(year, 11, 31));
}
```

- [ ] **Step 5: Implement `buildCalorieAdherenceHeatmapData`**

Return `HeatmapData` with `cells` shaped 7 rows by week columns. Use explicit dates for every cell from `startWeek` through `endWeek`; mark cells before `startDate` as `outside` and cells after the local `endKey` as `future`.

Important rules:
- `logged`: date has calories and a valid target.
- `unlogged`: date is in the past or today, but has no valid ratio.
- `future`: date is after the local `endKey`.
- `outside`: date exists only as Monday-week padding before `startDate`; render disabled and exclude from adherence totals.
- future cells do not count toward adherence rate in UI.

- [ ] **Step 6: Preserve old matrix helper**

Keep `buildCalorieAdherenceHeatmap` as a compatibility wrapper:

```ts
export function buildCalorieAdherenceHeatmap(input: BuildCalorieAdherenceHeatmapInput): (number | null)[][] {
  return buildCalorieAdherenceHeatmapData(input).cells.map((row) =>
    row.map((cell) => (cell.status === 'logged' ? cell.ratio : null))
  );
}
```

- [ ] **Step 7: Run adherence tests**

Run: `bun run test lib/dashboard/adherence.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/dashboard/adherence.ts lib/dashboard/adherence.test.ts
git commit -m "feat: add date-aware dashboard heatmap data"
```

### Task 3: Add adaptive heatmap range helper

**Files:**
- Create: `lib/dashboard/heatmap-range.ts`
- Modify: `lib/dashboard/adherence.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `lib/dashboard/adherence.test.ts`:

```ts
import { chooseRenderedHeatmapRange } from '@/lib/dashboard/heatmap-range';

describe('chooseRenderedHeatmapRange', () => {
  it('keeps year when cells and month labels fit', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 760,
        weekCount: { year: 53, '90d': 14, '30d': 5 },
      })
    ).toBe('year');
  });

  it('falls back from year to 90d when year cells are too small', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 420,
        weekCount: { year: 53, '90d': 14, '30d': 5 },
      })
    ).toBe('90d');
  });

  it('falls back when year cells fit but month labels would overlap', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 680,
        weekCount: { year: 53, '90d': 14, '30d': 5 },
      })
    ).toBe('90d');
  });

  it('falls back from preferred 90d when cells are too cramped', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: '90d',
        availableWidth: 120,
        weekCount: { year: 53, '90d': 14, '30d': 5 },
      })
    ).toBe('30d');
  });

  it('falls back to 30d when 90d cells are too small', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 120,
        weekCount: { year: 53, '90d': 14, '30d': 5 },
      })
    ).toBe('30d');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test lib/dashboard/adherence.test.ts`

Expected: FAIL because helper file does not exist.

- [ ] **Step 3: Implement helper**

```ts
import type { HeatmapRange } from '@/lib/types/dashboard';

interface ChooseRenderedHeatmapRangeInput {
  preferredRange: HeatmapRange;
  availableWidth: number;
  weekCount: Record<HeatmapRange, number>;
}

const YEAR_MIN_CELL = 10;
const RANGE_90_MIN_CELL = 14;
const DAY_LABEL_WIDTH = 18;
const CELL_GAP = 2;
const MIN_MONTH_LABEL_WIDTH = 52;

function cellSizeFor(width: number, columns: number): number {
  return Math.floor((width - DAY_LABEL_WIDTH - Math.max(0, columns - 1) * CELL_GAP) / columns);
}

export function chooseRenderedHeatmapRange({
  preferredRange,
  availableWidth,
  weekCount,
}: ChooseRenderedHeatmapRangeInput): HeatmapRange {
  if (preferredRange === '30d') return '30d';
  if (
    preferredRange === '90d' &&
    cellSizeFor(availableWidth, weekCount['90d']) >= RANGE_90_MIN_CELL
  ) {
    return '90d';
  }
  if (preferredRange === '90d') return '30d';

  const yearCell = cellSizeFor(availableWidth, weekCount.year);
  const monthLabelsFit = yearCell * 4 + CELL_GAP * 3 >= MIN_MONTH_LABEL_WIDTH;
  if (yearCell >= YEAR_MIN_CELL && monthLabelsFit) return 'year';
  if (cellSizeFor(availableWidth, weekCount['90d']) >= RANGE_90_MIN_CELL) return '90d';
  return '30d';
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test lib/dashboard/adherence.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/heatmap-range.ts lib/dashboard/adherence.test.ts
git commit -m "feat: add adaptive heatmap range helper"
```

### Task 4: Add weight trend summary helper

**Files:**
- Create: `lib/dashboard/weight-trend.ts`
- Create: `lib/dashboard/weight-trend.test.ts`
- Modify: `lib/types/weight.ts`
- Modify: `lib/actions/weight.ts`
- Modify: `lib/actions/__tests__/weight.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildWeightTrendSummary } from '@/lib/dashboard/weight-trend';

describe('buildWeightTrendSummary', () => {
  it('returns insufficient data below two weigh-ins', () => {
    expect(
      buildWeightTrendSummary({
        weights: [68.2],
        periodStartWeight: 68.2,
        expectedEndWeight: 66.5,
        goalDirection: 'down',
        range: '30d',
      }).status
    ).toBe('insufficient');
  });

  it('marks a cut as on pace within tolerance', () => {
    const summary = buildWeightTrendSummary({
      weights: [68.2, 66.5],
      periodStartWeight: 68.2,
      expectedEndWeight: 66.5,
      goalDirection: 'down',
      range: '30d',
    });

    expect(summary.startWeight).toBe(68.2);
    expect(summary.currentWeight).toBe(66.5);
    expect(summary.status).toBe('on_pace');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test lib/dashboard/weight-trend.test.ts`

Expected: FAIL because helper file does not exist.

- [ ] **Step 3: Implement helper with stable verdicts**

Use this public shape:

```ts
import type { WeightGoalDirection, WeightRange } from '@/lib/types/weight';

export type WeightTrendStatus =
  | 'insufficient'
  | 'on_pace'
  | 'ahead'
  | 'behind'
  | 'stable';

interface BuildWeightTrendSummaryInput {
  weights: number[];
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: WeightGoalDirection;
  range: WeightRange;
  elapsedDays?: number;
}

export interface WeightTrendSummary {
  status: WeightTrendStatus;
  startWeight: number;
  currentWeight: number;
  expectedEndWeight: number;
  projectedEndWeight: number;
  actualWeeklyRate: number;
  expectedWeeklyRate: number;
  rangeDays: number;
  canProject: boolean;
}
```

Rules:
- `rangeDays` is 30 or 90.
- `expectedWeeklyRate = (expectedEndWeight - periodStartWeight) / rangeDays * 7`.
- `actualWeeklyRate = (currentWeight - startWeight) / elapsedDays * 7` when `elapsedDays` is present and positive.
- fall back to `(currentWeight - startWeight) / rangeDays * 7` only for verdicts when elapsed-day metadata is missing.
- `projectedEndWeight = currentWeight + actualWeeklyRate * ((rangeDays - elapsedDays) / 7)` when `elapsedDays` is present, positive, and less than `rangeDays`.
- when projection is unavailable, set `projectedEndWeight` to `currentWeight` and `canProject` to `false`.
- `canProject = weights.length >= 3 && elapsedDays !== undefined && elapsedDays > 0 && elapsedDays < rangeDays`.
- if `weights.length < 2`, status is `insufficient`.
- if `goalDirection === 'flat'`, status is `stable` when `Math.abs(actualWeeklyRate) <= 0.1`, otherwise `behind`.
- tolerance is `Math.max(Math.abs(expectedWeeklyRate) * 0.2, 0.1)`.

- [ ] **Step 4: Add ahead/behind/flat tests**

Cover:
- cutting moving opposite direction is `behind`
- bulking faster than expected is `ahead`
- maintenance small movement is `stable`
- tiny expected rate uses the 0.1 kg/week fallback
- three points with `elapsedDays: 14` project beyond current weight by range end:

```ts
const projected = buildWeightTrendSummary({
  weights: [68.2, 67.8, 67.4],
  periodStartWeight: 68.2,
  expectedEndWeight: 66.5,
  goalDirection: 'down',
  range: '30d',
  elapsedDays: 14,
});

expect(projected.canProject).toBe(true);
expect(projected.actualWeeklyRate).toBeCloseTo(-0.4, 2);
expect(projected.projectedEndWeight).toBeCloseTo(66.49, 2);
```

- three points without `elapsedDays` have `canProject: false`

- [ ] **Step 5: Add elapsed-day metadata to weight summary**

Update `lib/types/weight.ts`:

```ts
export interface WeightSummaryData {
  // existing fields...
  periodElapsedDays: number | null;
}
```

In `lib/actions/weight.ts`, derive `periodElapsedDays` from the first and latest logged dates in the selected range:

```ts
const firstRangeRow = rows[0];
const lastRangeRow = rows[rows.length - 1];
const periodElapsedDays =
  firstRangeRow && lastRangeRow
    ? Math.max(1, Math.round(
        (new Date(`${lastRangeRow.loggedDate}T00:00:00.000Z`).getTime() -
          new Date(`${firstRangeRow.loggedDate}T00:00:00.000Z`).getTime()) /
          (24 * 60 * 60 * 1000)
      ))
    : null;
```

Return `periodElapsedDays` with `WeightSummaryData`.

Update `lib/actions/__tests__/weight.test.ts` in the existing `loadWeightSummaryAction` suite. Extend the existing `loads range rows and computes summary metadata` test:

```ts
const startDate = new Date(`${today}T00:00:00.000Z`);
startDate.setUTCDate(startDate.getUTCDate() - 14);
const startDateKey = startDate.toISOString().slice(0, 10);

const rangeRows = [
  { loggedDate: startDateKey, weightKg: '68.2' },
  { loggedDate: today, weightKg: '67.4' },
];
const latestRows = [{ loggedDate: today, weightKg: '67.4' }];

mockDbSelect
  .mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rangeRows),
      }),
    }),
  })
  .mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(latestRows),
        }),
      }),
    }),
  });

const result = await loadWeightSummaryAction({
  range: '30d',
  timezoneOffset: 0,
});

expect(result.weights).toEqual([68.2, 67.4]);
expect(result.periodElapsedDays).toBe(14);
```

- [ ] **Step 6: Run tests**

Run:

```bash
bun run test lib/dashboard/weight-trend.test.ts lib/actions/__tests__/weight.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/dashboard/weight-trend.ts lib/dashboard/weight-trend.test.ts lib/types/weight.ts lib/actions/weight.ts lib/actions/__tests__/weight.test.ts
git commit -m "feat: add dashboard weight trend summary"
```

---

## Chunk 2: Today Dock and Meal Entry Surface

### Files and responsibilities

- Create: `components/dashboard/today/today-dock.tsx` — top dashboard action surface with calories remaining, meal receipts, desktop meal action, and compact weight action.
- Create: `components/dashboard/current/compact-weight-log.tsx` — compact weight logging affordance reused by Today Dock and insufficient-data states.
- Modify: `components/dashboard/today/meal-trigger.tsx` — support mobile floating and desktop inline variants without boolean prop proliferation.
- Modify: `components/dashboard/today/meal-list.tsx` — render compact receipt rows and useful empty state.
- Create: `components/dashboard/today/today-dock.test.tsx` — test calories line, meals, empty state, and desktop action.
- Modify: `messages/en.json` and `messages/vi.json` — add Today Dock and meal action copy.

### Task 5: Create Today Dock tests

**Files:**
- Create: `components/dashboard/today/today-dock.test.tsx`

- [ ] **Step 1: Mock router and render Today Dock**

Write tests with Testing Library:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodayDock } from './today-dock';

const nutrition = {
  calories: { current: 1280, target: 2000 },
  protein: { current: 90, target: 150 },
  carbs: { current: 130, target: 250 },
  fat: { current: 40, target: 65 },
};

describe('TodayDock', () => {
  it('renders calories remaining as the first status line', () => {
    render(<TodayDock nutrition={nutrition} meals={[]} weightSummary={undefined} />);
    expect(screen.getByText('720')).toBeInTheDocument();
    expect(screen.getByText(/720/)).toBeInTheDocument();
    expect(screen.getByText('caloriesLeftStatus')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add meal receipt test**

```tsx
it('renders meals already eaten near the calories status', () => {
  render(
    <TodayDock
      nutrition={nutrition}
      meals={[{ id: 'm1', label: 'cơm gà', calories: 640 }]}
      weightSummary={undefined}
    />
  );

  expect(screen.getByText('cơm gà')).toBeInTheDocument();
  expect(screen.getByText(/640/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Add empty-state test**

```tsx
it('teaches the first meal action when no meals are logged', () => {
  render(<TodayDock nutrition={nutrition} meals={[]} weightSummary={undefined} />);

  expect(screen.getByText('firstMealHint')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run test to verify failure**

Run: `bun run test components/dashboard/today/today-dock.test.tsx`

Expected: FAIL because `TodayDock` does not exist.

### Task 6: Implement Today Dock

**Files:**
- Create: `components/dashboard/today/today-dock.tsx`
- Create: `components/dashboard/current/compact-weight-log.tsx`
- Modify: `components/dashboard/today/meal-list.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Add i18n keys**

Add under `dashboard` in both message files:

```json
"todayDock": {
  "caloriesLeftStatus": "{calories} kcal left today",
  "caloriesProgress": "{current} of {target} kcal logged",
  "firstMealHint": "Log your first meal, then this becomes your running receipt.",
  "desktopMealPrompt": "Add a meal from here",
  "weightPrompt": "Log today's weight"
}
```

Use natural Vietnamese equivalents in `vi.json`.

- [ ] **Step 2: Implement component structure**

`TodayDock` should:
- derive `remaining` during render, not in state
- use `Intl.NumberFormat` through `toLocaleString()` for displayed numbers
- render a semantic `<section aria-labelledby="today-dock-title">`
- use `MealList` for receipts
- render desktop inline meal action with `hidden md:flex`
- leave floating mobile action to `DashboardShell`

- [ ] **Step 3: Keep weight compact**

Create `CompactWeightLog` as a real form using `useLogWeight`, `react-hook-form`, and `weightLogSchema`. It should expose date and weight inputs with visible labels or `sr-only` labels, a submit button, inline validation copy, and the same mutation invalidation behavior as `WeightCard`.

Use `CompactWeightLog` in Today Dock when `weightSummary?.todayWeight` is null. Do not ship a placeholder that cannot log weight.

- [ ] **Step 4: Add weight affordance test**

In `today-dock.test.tsx`, mock `useLogWeight` or wrap the component with a `QueryClientProvider`. Render:

```tsx
<TodayDock
  nutrition={nutrition}
  meals={[]}
  weightSummary={{
    range: '30d',
    weights: [],
    currentWeight: 68.2,
    todayWeight: null,
    weightPlaceholder: 68.2,
    daysLogged: 0,
    periodStartWeight: 68.2,
    expectedEndWeight: 66.5,
    goalDirection: 'down',
  }}
/>
```

Assert a real weight input and submit control exist:

```tsx
expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
```

- [ ] **Step 5: Run Today Dock test**

Run: `bun run test components/dashboard/today/today-dock.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/today/today-dock.tsx components/dashboard/today/meal-list.tsx components/dashboard/today/today-dock.test.tsx components/dashboard/current/compact-weight-log.tsx messages/en.json messages/vi.json
git commit -m "feat: add dashboard today dock"
```

### Task 7: Split MealTrigger into explicit variants

**Files:**
- Modify: `components/dashboard/today/meal-trigger.tsx`
- Modify: `components/dashboard/today/today-dock.tsx`
- Modify: `components/dashboard/today/today-dock.test.tsx`

- [ ] **Step 1: Refactor without boolean mode props**

Export explicit variants:

```tsx
export function FloatingMealTrigger() {
  return <MealTriggerFrame variant="floating" />;
}

export function InlineMealTrigger() {
  return <MealTriggerFrame variant="inline" />;
}
```

Keep `MealTrigger` as a temporary alias to `FloatingMealTrigger` for compatibility if needed.

- [ ] **Step 2: Preserve interaction contract**

Both variants should:
- push to `/logging?meal=...`
- focus the input after expansion
- restore focus to trigger on close
- use icon-only buttons with `aria-label`
- use `focus-visible` rings

Inline variant should not render a full-screen floating FAB. It should render visible text such as `logMeal` or `desktopMealPrompt` inside Today Dock on `md` and larger screens. Only its send/close controls may be icon-only, and those must keep `aria-label`.

- [ ] **Step 3: Test inline action and route behavior**

Update Today Dock test:

```tsx
expect(screen.getByRole('button', { name: 'desktopMealPrompt' })).toBeInTheDocument();
```

- [ ] **Step 4: Test focus and prefill behavior**

Mock `useRouter().push`, open the inline trigger, type `cơm gà`, submit, and expect:

```tsx
expect(input).toHaveFocus();
expect(pushMock).toHaveBeenCalledWith('/logging?meal=c%C6%A1m%20g%C3%A0');
```

Also assert that closing the composer returns focus to the trigger.

- [ ] **Step 5: Run tests**

Run: `bun run test components/dashboard/today/today-dock.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/today/meal-trigger.tsx components/dashboard/today/today-dock.tsx components/dashboard/today/today-dock.test.tsx components/dashboard/current/compact-weight-log.tsx
git commit -m "refactor: split dashboard meal trigger variants"
```

---

## Chunk 3: Progress Story and Quiet Weight Chart

### Files and responsibilities

- Create: `components/dashboard/progress/progress-story.tsx` — summary-first wrapper around WeightChart.
- Modify: `components/dashboard/progress/weight-chart.tsx` — keep chart quiet, accept optional summary-aware display flags if needed.
- Create: `components/dashboard/progress/progress-story.test.tsx` — render summary states and insufficient data state.
- Create: `components/dashboard/progress/weight-chart.test.tsx` — direct smoke coverage for no-data and chart rendering behavior.
- Modify: `messages/en.json` and `messages/vi.json` — add weight trend copy.

### Task 8: Test Progress Story copy and no-data state

**Files:**
- Create: `components/dashboard/progress/progress-story.test.tsx`

- [ ] **Step 1: Mock Recharts-heavy chart**

Mock `WeightChart` to keep tests focused:

```tsx
vi.mock('./weight-chart', () => ({
  WeightChart: () => <div data-testid="weight-chart" />,
}));
```

- [ ] **Step 2: Write summary render test**

Render `ProgressStory` with three weights and expect:
- start/current comparison is visible
- expected value is visible
- projection detail copy is visible because three data points are present
- chart placeholder is rendered

Because the repo's `next-intl` test mock returns keys, render numeric chip values outside the translated sentence and assert those visible numbers directly.

- [ ] **Step 3: Write insufficient data test**

Render with one weight and expect the insufficient data copy key, and no chart placeholder.

- [ ] **Step 4: Run test to verify failure**

Run: `bun run test components/dashboard/progress/progress-story.test.tsx`

Expected: FAIL because `ProgressStory` does not exist.

### Task 9: Implement Progress Story

**Files:**
- Create: `components/dashboard/progress/progress-story.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Add i18n keys**

Add under `dashboard.progressStory`:

```json
{
  "title": "Weight trend",
  "insufficient": "Two weigh-ins unlock your trend.",
  "onPace": "Moving on pace.",
  "ahead": "Moving faster than planned.",
  "behind": "Not moving as expected.",
  "stable": "Stable this range.",
  "startToNow": "{start} -> {current} kg",
  "expected": "Expected {expected} kg",
  "projection": "At this pace: {projected} kg by range end"
}
```

- [ ] **Step 2: Compose helper and chart**

Use `buildWeightTrendSummary` during render:

```tsx
const summary = buildWeightTrendSummary({
  weights: data,
  periodStartWeight,
  expectedEndWeight,
  goalDirection,
  range,
});
```

If `summary.status === 'insufficient'`, render a friendly empty state and a compact weight prompt. Otherwise render summary line, comparison chips, and `<WeightChart />`.

Projection behavior:
- if `summary.canProject` is true, render `progressStory.projection` with `summary.projectedEndWeight.toFixed(1)`
- if false, render expected value only and do not show projection copy

- [ ] **Step 3: Keep noise low**

Do not add multiple colored badges. Use one verdict line and muted chips. Chart remains the evidence, not the primary explanation.

- [ ] **Step 4: Run Progress Story tests**

Run: `bun run test components/dashboard/progress/progress-story.test.tsx lib/dashboard/weight-trend.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/progress/progress-story.tsx components/dashboard/progress/progress-story.test.tsx messages/en.json messages/vi.json
git commit -m "feat: add dashboard progress story"
```

### Task 10: Quiet the chart for summary-first reading

**Files:**
- Modify: `components/dashboard/progress/weight-chart.tsx`
- Modify: `components/dashboard/progress/weight-chart-tooltip.tsx`
- Create: `components/dashboard/progress/weight-chart.test.tsx`

- [ ] **Step 1: Reduce chart-only interpretation burden**

Keep:
- `ResponsiveContainer width="100%" height="100%"`
- `AreaChart`
- subtle gradient fill
- tooltip for exact values
- off-track `ReferenceArea` when useful

Avoid:
- new noisy legends
- requiring Y-axis labels to explain the status
- hardcoded white tooltip strokes where theme token exists

- [ ] **Step 2: Improve accessible chart label**

Wrap chart area with `role="img"` and an `aria-label` summarizing the visible trend if practical. If Recharts conflicts with role semantics, keep visible text summary in `ProgressStory` as the accessible source.

- [ ] **Step 3: Add direct chart smoke test**

Create `components/dashboard/progress/weight-chart.test.tsx`. Mock Recharts primitives so the non-empty branch verifies this component's composition without depending on Recharts layout internals in jsdom:

```tsx
vi.mock('recharts', () => {
  const Chart = ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="weight-chart-svg">{children}</svg>
  );

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    AreaChart: Chart,
    Area: () => <path data-testid="weight-area" />,
    ReferenceArea: () => <rect data-testid="off-track-zone" />,
    ReferenceLine: () => <line data-testid="start-line" />,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
```

Add no-data coverage:

```tsx
it('renders the insufficient data message when fewer than two points exist', () => {
  render(
    <WeightChart
      data={[68.2]}
      periodStartWeight={68.2}
      expectedEndWeight={66.5}
      goalDirection="down"
      range="30d"
    />
  );

  expect(screen.getByText(/Log your weight/)).toBeInTheDocument();
});
```

Add non-empty smoke coverage:

```tsx
it('renders the chart branch for enough points', () => {
  const { container } = render(
    <div style={{ width: 320, height: 180 }}>
      <WeightChart
        data={[68.2, 67.9, 67.6]}
        periodStartWeight={68.2}
        expectedEndWeight={66.5}
        goalDirection="down"
        range="30d"
      />
    </div>
  );

  expect(screen.getByTestId('weight-chart-svg')).toBeInTheDocument();
  expect(screen.getByTestId('weight-area')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run related tests**

Run: `bun run test components/dashboard/progress/progress-story.test.tsx components/dashboard/progress/weight-chart.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/progress/weight-chart.tsx components/dashboard/progress/weight-chart-tooltip.tsx components/dashboard/progress/weight-chart.test.tsx
git commit -m "refactor: simplify dashboard weight chart reading"
```

---

## Chunk 4: Consistency Heatmap with Year View

### Files and responsibilities

- Modify: `components/dashboard/progress/adherence-heatmap.tsx` — consume `HeatmapData`, render month headers, future cells, and accessible labels.
- Create: `components/dashboard/progress/adherence-heatmap.test.tsx` — test month headers, future cell labels, and adherence rate excluding future cells.
- Modify: `lib/actions/dashboard.ts` — return date-aware heatmap data for 30d/90d/year.
- Modify: `components/dashboard/dashboard-shell.tsx` — update heatmap action caller in the same chunk so the repo never has mixed matrix/object expectations.
- Modify: `lib/dashboard/adherence.ts` — use the new date-aware builder from Chunk 1 in the action.
- Modify: `messages/en.json` and `messages/vi.json` — add heatmap range and future labels.

### Task 11: Test heatmap month headers and future labels

**Files:**
- Create: `components/dashboard/progress/adherence-heatmap.test.tsx`

- [ ] **Step 1: Write render test**

Create minimal `HeatmapData` with 7 rows and 2 columns. Include:
- logged cell
- unlogged past cell
- future cell
- outside cell
- month header `{ month: 'Apr', startColumn: 0, span: 2 }`

Expect:
- month label visible
- future aria label visible through button name
- future cell has `disabled` or `aria-disabled="true"`
- outside cell has `disabled` or `aria-disabled="true"` and the outside label
- on-track rate excludes future cells
- on-track rate excludes outside cells

- [ ] **Step 2: Run test to verify failure or current incompatibility**

Run: `bun run test components/dashboard/progress/adherence-heatmap.test.tsx`

Expected: FAIL until component accepts `HeatmapData`.

### Task 12: Implement date-aware heatmap UI

**Files:**
- Modify: `components/dashboard/progress/adherence-heatmap.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Update props**

```ts
interface AdherenceHeatmapProps {
  data: HeatmapData;
  range: HeatmapRange;
}
```

- [ ] **Step 2: Render month headers**

Render month headers above the grid using `gridColumn: \`\${startColumn + 1} / span \${span}\``.

- [ ] **Step 3: Render statuses**

Rules:
- `logged`: color from `getHeatmapColor(cell.ratio)`.
- `unlogged`: dashed border.
- `future`: lower opacity, no tooltip claiming missed data.
- `outside`: visually quiet and disabled, used only for range padding before the start date.

- [ ] **Step 4: Accessibility**

Each cell remains a `<button type="button">` with clear `aria-label`.
Future and outside cells must be disabled or expose `aria-disabled="true"` and must be excluded from adherence totals.

Add copy keys:

```json
"future": "Future date",
"outside": "Outside this range",
"rangeYear": "Year",
"range90d": "90 days",
"range30d": "30 days"
```

- [ ] **Step 5: Do not commit yet**

Do not commit after this component-only step. `AdherenceHeatmap` now expects `HeatmapData`, so the repo is not safe to commit until Task 13 updates `loadCalorieAdherenceHeatmap` and `DashboardShell` in the same commit.

- [ ] **Step 6: Run heatmap tests**

Run: `bun run test components/dashboard/progress/adherence-heatmap.test.tsx lib/dashboard/adherence.test.ts`

Expected: PASS.

### Task 13: Wire year range through server action

**Files:**
- Modify: `lib/actions/dashboard.ts`
- Modify: `lib/dashboard/adherence.ts`
- Modify: `components/dashboard/dashboard-shell.tsx`
- Modify: `lib/dashboard/adherence.test.ts` if action-facing types need adjustment
- Modify: `components/dashboard/progress/adherence-heatmap.tsx`
- Create: `components/dashboard/progress/adherence-heatmap.test.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Extend Zod schema**

Change:

```ts
range: z.enum(['30d', '90d', 'year'])
```

- [ ] **Step 2: Calculate year boundaries**

For `year`, start at Jan 1 local date and use Jan 1 of the next local year as the exclusive end boundary. This prevents missing meals logged on Dec 31. Pass `now` to the builder so future cells are marked future.

- [ ] **Step 3: Return `HeatmapData`**

Update return type:

```ts
Promise<HeatmapData>
```

Use `buildCalorieAdherenceHeatmapData`.

- [ ] **Step 4: Update DashboardShell heatmap caller immediately**

In the same commit, update `components/dashboard/dashboard-shell.tsx` so:

- `emptyHeatmapData` is a `HeatmapData` object, not a matrix.
- `loadCalorieAdherenceHeatmap` query expects `HeatmapData`.
- `AdherenceHeatmap` receives `HeatmapData`.

Do not leave mixed expectations where the action returns `HeatmapData` but components expect `(number | null)[][]`.

- [ ] **Step 5: Run integration-sensitive tests**

Run:

```bash
bun run test lib/dashboard/adherence.test.ts components/dashboard/progress/adherence-heatmap.test.tsx app/[locale]/\(app\)/dashboard/page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/dashboard.ts lib/dashboard/adherence.ts lib/dashboard/adherence.test.ts components/dashboard/dashboard-shell.tsx components/dashboard/progress/adherence-heatmap.tsx components/dashboard/progress/adherence-heatmap.test.tsx messages/en.json messages/vi.json
git commit -m "feat: load yearly dashboard heatmap data"
```

---

## Chunk 5: Dashboard Shell Integration, Responsive Structure, and Final Verification

### Files and responsibilities

- Modify: `components/dashboard/dashboard-shell.tsx` — replace rigid three-row grid with responsive daily cockpit structure, separate `weightRange` and heatmap range intent, and wire TodayDock/ProgressStory/AdherenceHeatmap.
- Modify: `components/dashboard/progress/progress-section.tsx` — remove render-prop wrapper from shell usage; leave file only if still imported elsewhere.
- Modify: `components/dashboard/today/today-section.tsx` — remove from shell usage after TodayDock absorbs calories, meals, and macro context.
- Modify: `app/[locale]/(app)/dashboard/page.test.tsx` only if props or shell contract changes.
- Create or modify dashboard component tests as needed.

### Task 14: Integrate new dashboard structure

**Files:**
- Modify: `components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Replace range state names**

Use:

```ts
const [weightRange, setWeightRange] = useState<TimeRange>('30d');
const [preferredHeatmapRange, setPreferredHeatmapRange] =
  useState<HeatmapRange>('year');
```

Do not pass `year` to `useWeightSummary`.

- [ ] **Step 2: Compute rendered heatmap range before querying**

Add a container-width measurement at the heatmap panel boundary, then derive:

```ts
const renderedHeatmapRange = chooseRenderedHeatmapRange({
  preferredRange: preferredHeatmapRange,
  availableWidth: heatmapWidth,
  weekCount: {
    year: yearHeatmapWeekCount,
    '90d': ninetyDayHeatmapWeekCount,
    '30d': thirtyDayHeatmapWeekCount,
  },
});
```

Use `renderedHeatmapRange` in the TanStack Query key and server action input:

```ts
queryKey: ['dashboard', 'heatmapData', renderedHeatmapRange]
```

Keep `preferredHeatmapRange` stable across resizes. Only `renderedHeatmapRange` changes. Do not let `AdherenceHeatmap` silently fetch or switch ranges internally.

- [ ] **Step 3: Replace shell layout**

Use content-led structure:

```tsx
<div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 overflow-y-auto px-4 pt-4 pb-20 sm:px-6 lg:px-8">
  <TodayDock ... />
  <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
    <ProgressStory ... />
    <AdherenceHeatmap ... />
  </section>
</div>
```

Adjust exact classes for existing design tokens. Preserve the warm restrained vibe and avoid nested cards.

- [ ] **Step 4: Remove old shell section usage explicitly**

After wiring `TodayDock`, remove `TodaySection` from `DashboardShell` imports/usages. After wiring `ProgressStory` and `AdherenceHeatmap` directly, remove `ProgressSection` from `DashboardShell` imports/usages. If either file becomes unreferenced, delete it in this task; otherwise leave it unchanged for remaining consumers.

- [ ] **Step 5: Render meal triggers by viewport**

Render `FloatingMealTrigger` for mobile only and `InlineMealTrigger` inside TodayDock for `md+`.

- [ ] **Step 6: Add responsive visibility tests**

Add a DashboardShell-focused test or component-level tests that assert:

- mobile floating trigger has mobile-only classes or is rendered in the mobile slot
- inline trigger is rendered inside TodayDock for `md+`
- Today Dock appears before Progress Story in DOM order

If class-based responsive behavior is difficult to assert in jsdom, assert DOM order and class names directly.

- [ ] **Step 7: Run component tests**

Run:

```bash
bun run test components/dashboard/today/today-dock.test.tsx components/dashboard/progress/progress-story.test.tsx components/dashboard/progress/adherence-heatmap.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/dashboard-shell.tsx components/dashboard/progress/progress-section.tsx components/dashboard/today/today-section.tsx
git commit -m "feat: restructure dashboard cockpit layout"
```

### Task 15: Update dashboard copy and i18n consistency

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Search for hardcoded dashboard strings**

Run:

```bash
rg "'(Weight Trend|Off track|Log your weight|Saving\\.\\.\\.|Save|logged|kcal left)'|\"(Weight Trend|Off track|Log your weight|Saving\\.\\.\\.|Save|logged|kcal left)\"" components/dashboard
```

Expected: any remaining strings are intentional units or replaced with i18n keys.

- [ ] **Step 2: Replace loading ellipses**

Use the single-character ellipsis `…` in user-facing loading copy.

- [ ] **Step 3: Ensure en/vi keys match**

Run a small Node check:

```bash
bun -e "const en=require('./messages/en.json'); const vi=require('./messages/vi.json'); console.log(JSON.stringify(Object.keys(en.dashboard).sort())===JSON.stringify(Object.keys(vi.dashboard).sort())?'dashboard keys match':'dashboard keys differ')"
```

Expected: `dashboard keys match`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/vi.json components/dashboard
git commit -m "fix: complete dashboard cockpit copy"
```

### Task 16: Full verification pass

**Files:**
- No planned source changes unless verification finds issues.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun run test lib/dashboard/adherence.test.ts lib/dashboard/weight-trend.test.ts components/dashboard/today/today-dock.test.tsx components/dashboard/progress/progress-story.test.tsx components/dashboard/progress/adherence-heatmap.test.tsx app/[locale]/\(app\)/dashboard/page.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `bun run test`

Expected: PASS.

- [ ] **Step 3: Run Biome autofix**

Run: `bunx @biomejs/biome@2.4.2 check --write .`

Expected: no unsafe fixes required.

- [ ] **Step 4: Run final Biome check**

Run: `bunx @biomejs/biome@2.4.2 check .`

Expected: PASS.

- [ ] **Step 5: Browser QA for responsive dashboard**

Start `bun dev` only for active Chrome DevTools testing. Check:
- mobile portrait: calories and floating meal action appear immediately
- tablet: Today Dock spans top and progress/heatmap adapt cleanly
- desktop: visible in-layout meal action, full-year heatmap when readable, no horizontal page scroll
- keyboard focus: meal trigger open/close focus restore works

- [ ] **Step 6: Final commit if verification required fixes**

```bash
git add components/dashboard lib/dashboard lib/actions messages app
git commit -m "fix: polish dashboard cockpit verification"
```

---

## Execution Notes

- Run implementation in a dedicated worktree before touching code.
- Do not run `bun run build` unless explicitly requested.
- Do not run remote database commands.
- Keep `useWeightSummary` limited to `'30d' | '90d'`.
- Prefer derived values during render over effect-synchronized state.
- Avoid new boolean mode props; create explicit component variants for floating vs inline meal actions.
- Preserve existing functionality: meal prefill route, weight logging, dashboard query invalidation, section hierarchy, and current warm visual identity.
