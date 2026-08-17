# Dashboard Data Wiring & i18n Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded mock data in the dashboard with real DB queries and complete i18n for every dashboard component.

**Architecture:** Each dashboard section (Current, Progress, Today) owns its own `useQuery → server action` call. DashboardShell becomes a thin layout shell managing only `timeRange` state. Work is split across 3 independent git worktrees — one per section — to enable parallel development and clean merges.

**Tech Stack:** Next.js App Router, TanStack Query, Drizzle ORM (postgres.js), next-intl, sonner, Vitest

**Spec:** `docs/superpowers/specs/2026-04-20-dashboard-data-wiring-design.md`

---

## Chunk 1: Worktree `feat/dashboard-current-section`

### Task 1.0: Create worktree and branch

**Files:** None

- [ ] **Step 1: Create worktree**

```bash
cd /Users/khoivo/Documents/nham
git worktree add ../kallo-current-section -b feat/dashboard-current-section
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/khoivo/Documents/kallo-current-section && bun install
```

---

### Task 1.1: Create server action `getCurrentSectionData()`

**Files:**
- Create: `lib/dashboard/actions/current.ts`

- [ ] **Step 1: Write the server action**

```ts
'use server';

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { requireAuthAndProfile } from '@/lib/infra/auth';
import { db } from '@/lib/infra/db/client';
import { bodyWeightLog, meals } from '@/lib/infra/db/schema';
import type { PaceStatus, StatsData, VerdictData } from '@/components/dashboard/types';

interface CurrentSectionData {
  verdict: VerdictData;
  stats: StatsData;
  caloriesRemaining: number;
  calorieTarget: number;
}

export async function getCurrentSectionData(): Promise<CurrentSectionData> {
  const { user, profile } = await requireAuthAndProfile();
  const userId = user.id;
  const calorieTarget = profile.calorieTarget ?? 2000;
  const proteinTarget = profile.proteinTargetG ?? 140;

  // ── Weight data ──
  const latestWeights = await db
    .select({ weightKg: bodyWeightLog.weightKg, loggedDate: bodyWeightLog.loggedDate })
    .from(bodyWeightLog)
    .where(eq(bodyWeightLog.userId, userId))
    .orderBy(desc(bodyWeightLog.loggedDate))
    .limit(14);

  const firstWeight = await db
    .select({ weightKg: bodyWeightLog.weightKg, loggedDate: bodyWeightLog.loggedDate })
    .from(bodyWeightLog)
    .where(eq(bodyWeightLog.userId, userId))
    .orderBy(asc(bodyWeightLog.loggedDate))
    .limit(1);

  const currentWeight = latestWeights[0]
    ? Number(latestWeights[0].weightKg)
    : Number(profile.weightKg ?? 0);

  const totalEntries = latestWeights.length;

  // Rolling average: last 7 vs prior 7
  const recent7 = latestWeights.slice(0, Math.min(7, totalEntries));
  const prior7 = latestWeights.slice(7, 14);
  const avg = (arr: typeof recent7) =>
    arr.length > 0 ? arr.reduce((s, r) => s + Number(r.weightKg), 0) / arr.length : 0;

  const recentAvg = avg(recent7);
  const priorAvg = prior7.length > 0 ? avg(prior7) : recentAvg;
  const weeklyRate = Math.round((recentAvg - priorAvg) * 10) / 10;

  const firstEntry = firstWeight[0];
  const totalDelta = firstEntry
    ? Math.round((currentWeight - Number(firstEntry.weightKg)) * 10) / 10
    : 0;
  const planStartDate = firstEntry?.loggedDate ?? new Date().toISOString().slice(0, 10);

  // PaceStatus
  let status: PaceStatus = 'too_early';
  if (totalEntries >= 2) {
    const goal = profile.goal;
    const aggression = Number(profile.aggression ?? 0.3);
    // Expected weekly rate: cutting = negative, bulking = positive
    const expectedRate = goal === 'cutting' ? -aggression : goal === 'bulking' ? aggression : 0;
    if (expectedRate === 0) {
      // Maintaining: on_pace if within ±0.2 kg/week
      status = Math.abs(weeklyRate) <= 0.2 ? 'on_pace' : weeklyRate > 0 ? 'ahead' : 'behind';
    } else {
      const ratio = weeklyRate / expectedRate;
      if (ratio >= 0.8 && ratio <= 1.2) status = 'on_pace';
      else if (ratio > 1.2) status = 'ahead';
      else status = 'behind';
    }
  }

  // ── Meals this week (Mon–Sun) ──
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekMeals = await db
    .select({
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      loggedAt: meals.loggedAt,
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, monday),
        lte(meals.loggedAt, sunday),
      )
    );

  // Group by day-of-week (0=Mon..6=Sun)
  const dailyCals: number[] = Array(7).fill(0);
  const dailyProtein: number[] = Array(7).fill(0);
  const daysWithMeals = new Set<number>();

  for (const m of weekMeals) {
    const mDate = new Date(m.loggedAt);
    const dayIdx = (mDate.getDay() + 6) % 7; // Mon=0..Sun=6
    dailyCals[dayIdx] += m.caloriesKcal ?? 0;
    dailyProtein[dayIdx] += m.proteinG ?? 0;
    daysWithMeals.add(dayIdx);
  }

  const daysWithData = daysWithMeals.size;
  const avgDailyCalories = daysWithData > 0
    ? dailyCals.reduce((s, c) => s + c, 0) / daysWithData
    : 0;
  const avgDeficit = Math.round(calorieTarget - avgDailyCalories);

  const proteinDays = dailyProtein.map((p) => p >= proteinTarget) as [
    boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  ];

  // ── Today's calories ──
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayMeals = weekMeals.filter((m) => {
    const d = new Date(m.loggedAt);
    return d >= todayStart && d <= todayEnd;
  });
  const todayCalories = todayMeals.reduce((s, m) => s + (m.caloriesKcal ?? 0), 0);
  const caloriesRemaining = Math.max(0, calorieTarget - todayCalories);

  // ── Weight card display data ──
  const todayDateStr = now.toISOString().slice(0, 10);
  const todayWeightEntry = latestWeights.find((w) => w.loggedDate === todayDateStr);
  const todayWeight = todayWeightEntry ? Number(todayWeightEntry.weightKg) : null;
  const daysLogged = latestWeights.length;

  return {
    verdict: {
      weeklyRate,
      totalDelta,
      planStartDate,
      status,
      rollingAvg: { start: priorAvg || recentAvg, end: recentAvg },
      currentWeight,
      proteinDays,
    },
    stats: {
      daysLogged,
      avgDeficit,
      todayWeight,
      weightPlaceholder: currentWeight,
    },
    caloriesRemaining,
    calorieTarget,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/dashboard/actions/current.ts
git commit -m "feat(dashboard): add getCurrentSectionData server action"
```

---

### Task 1.2: Write test for `getCurrentSectionData()`

**Files:**
- Create: `lib/dashboard/__tests__/current-action.test.ts`

- [ ] **Step 1: Write unit test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PaceStatus } from '@/components/dashboard/types';

// Mock dependencies before importing the action
vi.mock('@/lib/infra/auth', () => ({
  requireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { getCurrentSectionData } from '@/lib/domain/dashboard/actions/current';
import { requireAuthAndProfile } from '@/lib/infra/auth';
import { db } from '@/lib/infra/db/client';

const mockProfile = {
  weightKg: '70.0',
  calorieTarget: 1800,
  proteinTargetG: 140,
  goal: 'cutting',
  aggression: '0.4',
};

function mockAuth() {
  vi.mocked(requireAuthAndProfile).mockResolvedValue({
    user: { id: 'user-1' },
    profile: mockProfile as any,
  });
}

// Drizzle query builder is thenable — mock must include .then() so
// queries ending at .where() or .orderBy() (without .limit()) resolve correctly.
function chainableSelect(rows: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnValue(undefined), // overwritten below
    where: vi.fn().mockReturnValue(undefined),
    orderBy: vi.fn().mockReturnValue(undefined),
    limit: vi.fn().mockReturnValue(undefined),
    then: (resolve: any) => resolve(rows),
  };
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('getCurrentSectionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  it('returns too_early when fewer than 2 weight entries', async () => {
    const oneEntry = [{ weightKg: '70.0', loggedDate: '2026-04-20' }];
    vi.mocked(db.select)
      .mockReturnValueOnce(chainableSelect(oneEntry) as any)   // latest 14
      .mockReturnValueOnce(chainableSelect(oneEntry) as any)   // first ever
      .mockReturnValueOnce(chainableSelect([]) as any);        // week meals

    const result = await getCurrentSectionData();
    expect(result.verdict.status).toBe('too_early');
    expect(result.verdict.currentWeight).toBe(70.0);
  });

  it('computes caloriesRemaining from today meals', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const weights = [
      { weightKg: '69.0', loggedDate: today },
      { weightKg: '69.5', loggedDate: '2026-04-19' },
    ];
    const todayMeal = {
      caloriesKcal: 500,
      proteinG: 40,
      loggedAt: new Date(),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(chainableSelect(weights) as any)       // latest 14
      .mockReturnValueOnce(chainableSelect([weights[1]]) as any)  // first ever
      .mockReturnValueOnce(chainableSelect([todayMeal]) as any);  // week meals

    const result = await getCurrentSectionData();
    expect(result.caloriesRemaining).toBe(1300); // 1800 - 500
    expect(result.calorieTarget).toBe(1800);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/khoivo/Documents/kallo-current-section
bun --env-file=.env.local vitest run lib/dashboard/__tests__/current-action.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/__tests__/current-action.test.ts
git commit -m "test(dashboard): add getCurrentSectionData unit tests"
```

---

### Task 1.3: Remove `streak` from `StatsData` type

**Files:**
- Modify: `components/dashboard/types.ts:21-27`

- [ ] **Step 1: Remove streak field**

In `components/dashboard/types.ts`, remove the `streak` field from `StatsData`:

```ts
// Before:
export interface StatsData {
  streak: number;
  daysLogged: number;
  avgDeficit: number;
  todayWeight: number | null;
  weightPlaceholder: number;
}

// After:
export interface StatsData {
  daysLogged: number;
  avgDeficit: number;
  todayWeight: number | null;
  weightPlaceholder: number;
}
```

- [ ] **Step 2: Remove streak from mock-data.ts**

In `components/dashboard/mock-data.ts`, remove `streak: 12` from `getStatsData()`.

- [ ] **Step 3: Verify no other files reference streak**

```bash
cd /Users/khoivo/Documents/kallo-current-section
grep -rn 'streak' components/dashboard/ --include='*.ts' --include='*.tsx'
```

Expected: No references to `streak` remain.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/types.ts components/dashboard/mock-data.ts
git commit -m "refactor(dashboard): remove dead streak field from StatsData"
```

---

### Task 1.4: Add i18n keys for Current Section

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Add English keys**

In `messages/en.json`, restructure the `dashboard` object. Add `fetchError` at the top level (shared across all sections), nest `caloriesRemaining` under `current`, and add all new keys. The final shape of the new/modified keys inside `dashboard`:

```json
{
  "fetchError": "Something went wrong loading data",
  "current": {
    "caloriesRemaining": "Calories remaining",
    "paceCard": {
      "title": "Current Pace",
      "kgPerWeek": "kg / wk",
      "onPace": "On pace",
      "ahead": "Ahead",
      "behind": "Behind",
      "tooEarly": "Too early to tell",
      "since": "since {date}",
      "totalDelta": "{delta} kg"
    },
    "deficitCard": {
      "title": "Avg Daily Deficit",
      "kcalPerDay": "kcal / day",
      "target": "Target: ~{target} kcal/day"
    },
    "proteinCard": {
      "daysCount": "/ {count} days",
      "mon": "M",
      "tue": "T",
      "wed": "W",
      "thu": "T",
      "fri": "F",
      "sat": "S",
      "sun": "S"
    }
  }
}
```

Also update existing `caloriesRemaining` key to `current.caloriesRemaining` — explicitly remove the old flat `"caloriesRemaining": "Calories remaining"` key from `dashboard`.

- [ ] **Step 2: Add Vietnamese keys**

In `messages/vi.json`, add matching keys:

```json
{
  "fetchError": "Đã xảy ra lỗi khi tải dữ liệu",
  "current": {
    "caloriesRemaining": "Calo còn lại",
    "paceCard": {
      "title": "Tốc độ hiện tại",
      "kgPerWeek": "kg / tuần",
      "onPace": "Đúng tiến độ",
      "ahead": "Nhanh hơn",
      "behind": "Chậm hơn",
      "tooEarly": "Còn quá sớm",
      "since": "từ {date}",
      "totalDelta": "{delta} kg"
    },
    "deficitCard": {
      "title": "TB Thiếu hụt/ngày",
      "kcalPerDay": "kcal / ngày",
      "target": "Mục tiêu: ~{target} kcal/ngày"
    },
    "proteinCard": {
      "daysCount": "/ {count} ngày",
      "mon": "T2",
      "tue": "T3",
      "wed": "T4",
      "thu": "T5",
      "fri": "T6",
      "sat": "T7",
      "sun": "CN"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/vi.json
git commit -m "feat(i18n): add dashboard.current section translations"
```

---

### Task 1.5: Wire CurrentSection to server action + i18n

**Files:**
- Modify: `components/dashboard/current/current-section.tsx`
- Modify: `components/dashboard/current/pace-deficit-card.tsx`
- Modify: `components/dashboard/current/protein-consistency-card.tsx`
- Modify: `components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Update CurrentSection to own its data**

Rewrite `components/dashboard/current/current-section.tsx`:
- Remove all props (verdict, stats, nutrition)
- Add `useQuery` calling `getCurrentSectionData()`
- Add loading skeleton and error toast
- Use `caloriesRemaining` from server action data (no longer compute from NutritionData)
- Pass `calorieTarget` to DeficitCard for dynamic target display
- Keep passing `verdict` and `stats` to child components (they still receive them as props)

Key changes:
```tsx
// Remove interface CurrentSectionProps — no more props
// Add: import { useQuery } from '@tanstack/react-query';
// Add: import { useEffect } from 'react';
// Add: import { toast } from 'sonner';
// Add: import { getCurrentSectionData } from '@/lib/domain/dashboard/actions/current';

export function CurrentSection() {
  const t = useTranslations('dashboard.current');
  const td = useTranslations('dashboard');
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'current'],
    queryFn: () => getCurrentSectionData(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (error) toast.error(td('fetchError'));
  }, [error, td]);

  if (isLoading || !data) {
    return <CurrentSectionSkeleton />;
  }

  const { verdict, stats, caloriesRemaining, calorieTarget } = data;
  // ... render using caloriesRemaining directly instead of computing from nutrition
}

function CurrentSectionSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="flex-1 rounded-2xl bg-kallo-hover h-[140px]" />
      <div className="flex-1 rounded-2xl bg-kallo-hover h-[140px]" />
      <div className="flex-1 rounded-2xl bg-kallo-hover h-[140px]" />
      <div className="flex-1 rounded-2xl bg-kallo-hover h-[140px]" />
    </div>
  );
}
```

Note: `t('caloriesRemaining')` now uses `useTranslations('dashboard.current')` — the key is `current.caloriesRemaining` in the JSON hierarchy, so `t('caloriesRemaining')` resolves correctly.

- [ ] **Step 2: i18n PaceCard**

In `components/dashboard/current/pace-deficit-card.tsx`:
- Add `useTranslations('dashboard.current.paceCard')` 
- Replace `STATUS_CONFIG` hardcoded labels with `t('onPace')`, `t('ahead')`, `t('behind')`, `t('tooEarly')`
- Replace `"Current Pace"` with `t('title')`
- Replace `"kg / wk"` with `t('kgPerWeek')`
- Replace `since {formatDate(planStartDate)}` with `t('since', { date: formatDate(planStartDate) })`
- Replace `{totalDelta} kg` pattern with `t('totalDelta', { delta: ... })`
- Make `formatDate` locale-aware: use `useLocale()` from next-intl and pass to `toLocaleDateString`

- [ ] **Step 3: i18n DeficitCard**

In `components/dashboard/current/pace-deficit-card.tsx`:
- Add `useTranslations('dashboard.current.deficitCard')` 
- Replace `"Avg Daily Deficit"` with `t('title')`
- Replace `"kcal / day"` with `t('kcalPerDay')`
- Replace `"Target: ~500 kcal/day"` with `t('target', { target: calorieTarget })` — receive `calorieTarget` as new prop
- Update `DeficitCardProps` to include `calorieTarget: number`

- [ ] **Step 4: i18n ProteinConsistencyCard**

In `components/dashboard/current/protein-consistency-card.tsx`:
- Change `useTranslations('dashboard')` to `useTranslations('dashboard.current.proteinCard')`
- Replace hardcoded `DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']` with:
  ```tsx
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  // In render: {DAY_KEYS.map((key, i) => ... t(key) ...)}
  ```
- Replace `"/ {proteinDays.length} days"` with `t('daysCount', { count: proteinDays.length })`
- The label that currently uses `t('protein')` should still use the parent namespace: `useTranslations('dashboard')` for `t('protein')`, or reference it via a second `useTranslations` call — simplest: keep two hooks: `const t = useTranslations('dashboard.current.proteinCard')` and `const td = useTranslations('dashboard')` for the protein label. **Important:** `dashboard.protein` must stay as a flat key — do NOT remove it, as it's shared with TodaySection.

- [ ] **Step 5: Clean up DashboardShell**

In `components/dashboard/dashboard-shell.tsx`:
- Remove the `verdict`, `stats`, and `nutrition` query blocks (lines 46-58, 81-86)
- Remove `getVerdictData`, `getStatsData`, `getNutritionData` imports from mock-data
- Simplify `<CurrentSection />` call — no more props
- Keep `meals` query for now (TodaySection still needs it in this worktree)

- [ ] **Step 6: Verify build**

```bash
cd /Users/khoivo/Documents/kallo-current-section
bunx @biomejs/biome check --write .
bun --env-file=.env.local vitest run lib/dashboard/__tests__/current-action.test.ts
```

Expected: Lint clean, tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(dashboard): wire CurrentSection to real data + i18n

- CurrentSection owns useQuery → getCurrentSectionData()
- PaceCard/DeficitCard/ProteinConsistencyCard fully i18n'd
- DeficitCard uses real calorie target from profile
- DashboardShell no longer fetches verdict/stats/nutrition"
```

---

## Chunk 2: Worktree `feat/dashboard-progress-section`

### Task 2.0: Create worktree and branch

**Files:** None

- [ ] **Step 1: Create worktree**

```bash
cd /Users/khoivo/Documents/nham
git worktree add ../kallo-progress-section -b feat/dashboard-progress-section
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/khoivo/Documents/kallo-progress-section && bun install
```

---

### Task 2.1: Create server action `getProgressData()`

**Files:**
- Create: `lib/dashboard/actions/progress.ts`

- [ ] **Step 1: Write the server action**

```ts
'use server';

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { requireAuthAndProfile } from '@/lib/infra/auth';
import { db } from '@/lib/infra/db/client';
import { bodyWeightLog, meals } from '@/lib/infra/db/schema';
import type { TimeRange } from '@/components/dashboard/types';

interface WeightChartMeta {
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: 'up' | 'down';
}

interface ProgressData {
  weightData: number[];
  weightChartMeta: WeightChartMeta;
  heatmapData: (number | null)[][];
}

export async function getProgressData(timeRange: TimeRange): Promise<ProgressData> {
  const { user, profile } = await requireAuthAndProfile();
  const userId = user.id;
  const calorieTarget = profile.calorieTarget ?? 2000;

  const days = timeRange === '30d' ? 30 : 90;
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - days);
  rangeStart.setHours(0, 0, 0, 0);

  // ── Weight data ──
  const weights = await db
    .select({ weightKg: bodyWeightLog.weightKg, loggedDate: bodyWeightLog.loggedDate })
    .from(bodyWeightLog)
    .where(
      and(
        eq(bodyWeightLog.userId, userId),
        gte(bodyWeightLog.loggedDate, rangeStart.toISOString().slice(0, 10)),
      )
    )
    .orderBy(asc(bodyWeightLog.loggedDate));

  const weightData = weights.map((w) => Number(w.weightKg));

  // Chart meta
  const periodStartWeight = weightData[0] ?? Number(profile.weightKg ?? 0);
  const weeks = timeRange === '30d' ? 4.3 : 12.9;
  const aggression = Number(profile.aggression ?? 0.3);
  const goalDirection: 'up' | 'down' = profile.goal === 'bulking' ? 'up' : 'down';
  const weeklyChange = goalDirection === 'down' ? -aggression : aggression;
  const expectedEndWeight = Math.round((periodStartWeight + weeklyChange * weeks) * 10) / 10;

  const weightChartMeta: WeightChartMeta = {
    periodStartWeight,
    expectedEndWeight,
    goalDirection,
  };

  // ── Heatmap: adherence ratios ──
  const rangeMeals = await db
    .select({
      caloriesKcal: meals.caloriesKcal,
      loggedAt: meals.loggedAt,
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, rangeStart),
      )
    );

  // Group by date string → daily calorie sum
  const dailyCals = new Map<string, number>();
  for (const m of rangeMeals) {
    const dateStr = new Date(m.loggedAt).toISOString().slice(0, 10);
    dailyCals.set(dateStr, (dailyCals.get(dateStr) ?? 0) + (m.caloriesKcal ?? 0));
  }

  // Build weeks (Mon–Sun) covering the range
  const today = new Date();
  const todayDay = today.getDay(); // 0=Sun
  const diffToMon = todayDay === 0 ? -6 : 1 - todayDay;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + diffToMon);
  currentMonday.setHours(0, 0, 0, 0);

  const numWeeks = Math.ceil(days / 7);
  const weeksData: (number | null)[][] = [];

  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - w * 7);
    const weekDays: (number | null)[] = [];

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + d);
      const dateStr = dayDate.toISOString().slice(0, 10);

      // Future days or days before range start = null
      if (dayDate > today || dayDate < rangeStart) {
        weekDays.push(null);
      } else {
        const cals = dailyCals.get(dateStr);
        weekDays.push(cals != null ? cals / calorieTarget : null);
      }
    }
    weeksData.push(weekDays);
  }

  // Transpose: 7 rows (Mon→Sun) × N columns (weeks)
  const heatmapData = Array.from({ length: 7 }, (_, dayIdx) =>
    weeksData.map((week) => week[dayIdx])
  );

  return { weightData, weightChartMeta, heatmapData };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/dashboard/actions/progress.ts
git commit -m "feat(dashboard): add getProgressData server action"
```

---

### Task 2.2: Write test for `getProgressData()`

**Files:**
- Create: `lib/dashboard/__tests__/progress-action.test.ts`

- [ ] **Step 1: Write unit test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/infra/auth', () => ({
  requireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { getProgressData } from '@/lib/domain/dashboard/actions/progress';
import { requireAuthAndProfile } from '@/lib/infra/auth';
import { db } from '@/lib/infra/db/client';

const mockProfile = {
  weightKg: '70.0',
  calorieTarget: 2000,
  goal: 'cutting',
  aggression: '0.4',
};

function mockAuth() {
  vi.mocked(requireAuthAndProfile).mockResolvedValue({
    user: { id: 'user-1' },
    profile: mockProfile as any,
  });
}

// Drizzle query builder is thenable — mock must include .then() so
// queries ending at .where() or .orderBy() (without .limit()) resolve correctly.
function chainableSelect(rows: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnValue(undefined),
    where: vi.fn().mockReturnValue(undefined),
    orderBy: vi.fn().mockReturnValue(undefined),
    limit: vi.fn().mockReturnValue(undefined),
    then: (resolve: any) => resolve(rows),
  };
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('getProgressData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  it('returns empty arrays when no data exists', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chainableSelect([]) as any)   // weights
      .mockReturnValueOnce(chainableSelect([]) as any);  // meals

    const result = await getProgressData('30d');
    expect(result.weightData).toEqual([]);
    expect(result.heatmapData).toHaveLength(7); // 7 rows always
    expect(result.weightChartMeta.goalDirection).toBe('down');
  });

  it('computes heatmap as 7 rows × N weeks', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chainableSelect([]) as any)
      .mockReturnValueOnce(chainableSelect([]) as any);

    const result = await getProgressData('30d');
    // 30d ≈ 5 weeks max
    expect(result.heatmapData.length).toBe(7);
    for (const row of result.heatmapData) {
      expect(row.length).toBeGreaterThanOrEqual(4);
      expect(row.length).toBeLessThanOrEqual(6);
    }
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd /Users/khoivo/Documents/kallo-progress-section
bun --env-file=.env.local vitest run lib/dashboard/__tests__/progress-action.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/__tests__/progress-action.test.ts
git commit -m "test(dashboard): add getProgressData unit tests"
```

---

### Task 2.3: Add i18n keys for Progress Section

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Restructure English keys**

In `messages/en.json`, add new keys under `dashboard.progress` — keep the old flat `"progress": "Progress"` and old `"adherenceHeatmap": {...}` for now (they'll be removed in Task 2.4 alongside component updates to avoid broken intermediate state):

```json
{
  "progress": {
    "title": "Progress",
    "weightTrend": "Weight Trend",
    "timeRange": {
      "30d": "30 days",
      "90d": "90 days"
    },
    "weightChart": {
      "notEnoughData": "Not enough data yet",
      "offTrack": "Off track"
    },
    "adherenceHeatmap": {
      "onTarget": "On target",
      "noData": "No data",
      "close": "Close",
      "slightlyOver": "Slightly over",
      "slightlyUnder": "Slightly under",
      "over": "Over",
      "under": "Under",
      "farOver": "Far over",
      "farUnder": "Far under",
      "mon": "M",
      "tue": "T",
      "wed": "W",
      "thu": "T",
      "fri": "F",
      "sat": "S",
      "sun": "S"
    }
  }
}
```

**Do NOT** remove old flat keys yet — they'll be removed in Task 2.4 alongside component updates.

Also ensure `dashboard.fetchError` exists (may already be added if Chunk 1 merged first — if not, add it):
```json
"fetchError": "Something went wrong loading data"
```
And in vi.json:
```json
"fetchError": "Đã xảy ra lỗi khi tải dữ liệu"
```

Similarly in `vi.json`, add new nested keys but keep old keys for now — remove in Task 2.4.

- [ ] **Step 2: Add Vietnamese keys**

```json
{
  "progress": {
    "title": "Tiến trình",
    "weightTrend": "Xu hướng cân nặng",
    "timeRange": {
      "30d": "30 ngày",
      "90d": "90 ngày"
    },
    "weightChart": {
      "notEnoughData": "Chưa đủ dữ liệu",
      "offTrack": "Lệch mục tiêu"
    },
    "adherenceHeatmap": {
      "onTarget": "Đúng mục tiêu",
      "noData": "Không có dữ liệu",
      "close": "Rất gần",
      "slightlyOver": "Hơi vượt",
      "slightlyUnder": "Hơi thiếu",
      "over": "Vượt",
      "under": "Thiếu",
      "farOver": "Vượt nhiều",
      "farUnder": "Thiếu nhiều",
      "mon": "T2",
      "tue": "T3",
      "wed": "T4",
      "thu": "T5",
      "fri": "T6",
      "sat": "T7",
      "sun": "CN"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/vi.json
git commit -m "feat(i18n): add dashboard.progress section translations"
```

---

### Task 2.4: Wire ProgressSection to server action + i18n

**Files:**
- Modify: `components/dashboard/progress/progress-section.tsx`
- Modify: `components/dashboard/progress/weight-chart.tsx`
- Modify: `components/dashboard/progress/adherence-heatmap.tsx`
- Modify: `components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Rewrite ProgressSection**

`components/dashboard/progress/progress-section.tsx` currently receives render props (`weightChart`, `heatmap`). Rewrite to:
- Accept `timeRange` and `onTimeRangeChange` props
- Own `useQuery('dashboard-progress', timeRange)` → `getProgressData(timeRange)`
- Absorb the progress header + time-range toggle from DashboardShell (lines 116-138)
- Render `WeightChart` and `AdherenceHeatmap` internally with fetched data
- Add loading skeleton and error toast

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getProgressData } from '@/lib/domain/dashboard/actions/progress';
import type { TimeRange } from '@/components/dashboard/types';
import { cn } from '@/lib/utils';
import { AdherenceHeatmap } from './adherence-heatmap';
import { WeightChart } from './weight-chart';

interface ProgressSectionProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

export function ProgressSection({ timeRange, onTimeRangeChange }: ProgressSectionProps) {
  const t = useTranslations('dashboard.progress');
  const td = useTranslations('dashboard');

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'progress', timeRange],
    queryFn: () => getProgressData(timeRange),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (error) toast.error(td('fetchError'));
  }, [error, td]);

  return (
    <>
      {/* Header with time-range toggle */}
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold text-[12px] text-kallo-stone uppercase tracking-[0.2em]">
          {t('title')}
        </span>
        <div className="flex rounded-xl bg-kallo-hover p-0.5">
          {(['30d', '90d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onTimeRangeChange(r)}
              className={cn(
                'rounded-lg px-3 py-1 font-medium text-[11px] transition-all',
                timeRange === r
                  ? 'bg-card text-kallo-text shadow-sm'
                  : 'text-kallo-stone hover:text-kallo-text-muted',
              )}
            >
              {t(`timeRange.${r}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="flex h-full gap-3">
        <div className="flex flex-1 flex-col rounded-2xl border border-kallo-border/60 bg-card p-3 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
          <span className="mb-1 block font-bold text-[10px] text-kallo-stone uppercase tracking-[0.15em]">
            {t('weightTrend')}
          </span>
          {isLoading || !data ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-kallo-stone/30 border-t-kallo-accent" />
            </div>
          ) : (
            <WeightChart
              data={data.weightData}
              periodStartWeight={data.weightChartMeta.periodStartWeight}
              expectedEndWeight={data.weightChartMeta.expectedEndWeight}
              goalDirection={data.weightChartMeta.goalDirection}
              range={timeRange}
            />
          )}
        </div>
        <div className="flex shrink-0 flex-col rounded-2xl border border-kallo-border/60 bg-card px-3 pt-3 pb-2 shadow-[0_4px_24px_rgba(44,36,22,0.04)] transition-all duration-300 ease-out">
          {isLoading || !data ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-kallo-stone/30 border-t-kallo-accent" />
            </div>
          ) : (
            <AdherenceHeatmap data={data.heatmapData} range={timeRange} />
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: i18n WeightChart**

In `components/dashboard/progress/weight-chart.tsx`:
- Add `useTranslations('dashboard.progress.weightChart')`
- Replace `"Not enough data yet"` (line 46) with `t('notEnoughData')`
- Replace `"Off track"` (line 72) with `t('offTrack')`

- [ ] **Step 3: i18n AdherenceHeatmap**

In `components/dashboard/progress/adherence-heatmap.tsx`:
- Change `useTranslations('dashboard.adherenceHeatmap')` to `useTranslations('dashboard.progress.adherenceHeatmap')` — keys stay the same, just namespace moves
- Replace hardcoded `DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']` with i18n day keys:
  ```tsx
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  // In render: t(DAY_KEYS[i])
  ```

- [ ] **Step 3b: Remove old i18n keys**

Now that all components are updated to new namespaces, remove old keys from both `messages/en.json` and `messages/vi.json`:
- Remove flat `"progress": "Progress"` (now `progress.title`)
- Remove top-level `"adherenceHeatmap": {...}` object (now under `progress.adherenceHeatmap`)

- [ ] **Step 4: Clean up DashboardShell**

In `components/dashboard/dashboard-shell.tsx`:
- Remove `weightData`, `weightChartMeta`, `heatmapData` query blocks (lines 60-79)
- Remove `getWeightData`, `getWeightChartMeta`, `getHeatmapData` imports from mock-data
- Remove `WeightChart`, `AdherenceHeatmap` imports
- Remove the progress header/toggle UI (lines 115-138)
- Replace with simple `<ProgressSection timeRange={timeRange} onTimeRangeChange={setTimeRange} />`
- Keep the `<section className="flex min-h-0 flex-col">` wrapper around ProgressSection (needed for grid row layout)

- [ ] **Step 5: Verify build + lint**

```bash
cd /Users/khoivo/Documents/kallo-progress-section
bunx @biomejs/biome check --write .
bun --env-file=.env.local vitest run lib/dashboard/__tests__/progress-action.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dashboard): wire ProgressSection to real data + i18n

- ProgressSection owns useQuery → getProgressData(timeRange)
- Absorbs time-range toggle + header from DashboardShell
- WeightChart + AdherenceHeatmap fully i18n'd
- Heatmap day labels translatable
- DashboardShell no longer fetches weight/chart/heatmap data"
```

---

## Chunk 3: Worktree `feat/dashboard-today-section`

### Task 3.0: Create worktree and branch

**Files:** None

- [ ] **Step 1: Create worktree**

```bash
cd /Users/khoivo/Documents/nham
git worktree add ../kallo-today-section -b feat/dashboard-today-section
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/khoivo/Documents/kallo-today-section && bun install
```

---

### Task 3.1: Create server action `getTodayData()`

**Files:**
- Create: `lib/dashboard/actions/today.ts`

- [ ] **Step 1: Write the server action**

```ts
'use server';

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { requireAuthAndProfile } from '@/lib/infra/auth';
import { db } from '@/lib/infra/db/client';
import { meals } from '@/lib/infra/db/schema';
import type { MealEntry, NutritionData } from '@/components/dashboard/types';

interface TodayData {
  nutrition: NutritionData;
  meals: MealEntry[];
}

export async function getTodayData(): Promise<TodayData> {
  const { user, profile } = await requireAuthAndProfile();
  const userId = user.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayMeals = await db
    .select({
      id: meals.id,
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
      loggedAt: meals.loggedAt,
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, todayStart),
        lte(meals.loggedAt, todayEnd),
      )
    )
    .orderBy(desc(meals.loggedAt));

  // Map to MealEntry (calories field, not caloriesKcal)
  const mealEntries: MealEntry[] = todayMeals.map((m) => ({
    id: m.id,
    label: m.rawInput,
    calories: m.caloriesKcal ?? 0,
  }));

  // Sum nutrition
  let totalCals = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const m of todayMeals) {
    totalCals += m.caloriesKcal ?? 0;
    totalProtein += m.proteinG ?? 0;
    totalCarbs += m.carbohydrateG ?? 0;
    totalFat += m.fatG ?? 0;
  }

  const nutrition: NutritionData = {
    calories: { current: Math.round(totalCals), target: profile.calorieTarget ?? 2000 },
    protein: { current: Math.round(totalProtein), target: profile.proteinTargetG ?? 140 },
    carbs: { current: Math.round(totalCarbs), target: profile.carbsTargetG ?? 180 },
    fat: { current: Math.round(totalFat), target: profile.fatTargetG ?? 60 },
  };

  return { nutrition, meals: mealEntries };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/dashboard/actions/today.ts
git commit -m "feat(dashboard): add getTodayData server action"
```

---

### Task 3.2: Write test for `getTodayData()`

**Files:**
- Create: `lib/dashboard/__tests__/today-action.test.ts`

- [ ] **Step 1: Write unit test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/infra/auth', () => ({
  requireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { getTodayData } from '@/lib/domain/dashboard/actions/today';
import { requireAuthAndProfile } from '@/lib/infra/auth';
import { db } from '@/lib/infra/db/client';

const mockProfile = {
  calorieTarget: 2000,
  proteinTargetG: 140,
  carbsTargetG: 200,
  fatTargetG: 65,
};

function mockAuth() {
  vi.mocked(requireAuthAndProfile).mockResolvedValue({
    user: { id: 'user-1' },
    profile: mockProfile as any,
  });
}

// Drizzle query builder is thenable — mock must include .then() so
// queries ending at .where() or .orderBy() (without .limit()) resolve correctly.
function chainableSelect(rows: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnValue(undefined),
    where: vi.fn().mockReturnValue(undefined),
    orderBy: vi.fn().mockReturnValue(undefined),
    then: (resolve: any) => resolve(rows),
  };
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('getTodayData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  it('returns empty meals and zero nutrition when no meals today', async () => {
    vi.mocked(db.select).mockReturnValueOnce(chainableSelect([]) as any);

    const result = await getTodayData();
    expect(result.meals).toEqual([]);
    expect(result.nutrition.calories.current).toBe(0);
    expect(result.nutrition.calories.target).toBe(2000);
  });

  it('sums nutrition from multiple meals', async () => {
    const todayMeals = [
      { id: '1', rawInput: 'Phở bò', caloriesKcal: 480, proteinG: 30, carbohydrateG: 50, fatG: 15, loggedAt: new Date() },
      { id: '2', rawInput: 'Cà phê', caloriesKcal: 120, proteinG: 2, carbohydrateG: 20, fatG: 3, loggedAt: new Date() },
    ];

    vi.mocked(db.select).mockReturnValueOnce(chainableSelect(todayMeals) as any);

    const result = await getTodayData();
    expect(result.meals).toHaveLength(2);
    expect(result.meals[0].calories).toBe(480);
    expect(result.meals[0].label).toBe('Phở bò');
    expect(result.nutrition.calories.current).toBe(600);
    expect(result.nutrition.protein.current).toBe(32);
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd /Users/khoivo/Documents/kallo-today-section
bun --env-file=.env.local vitest run lib/dashboard/__tests__/today-action.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/__tests__/today-action.test.ts
git commit -m "test(dashboard): add getTodayData unit tests"
```

---

### Task 3.3: Add i18n keys for Today Section

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Restructure English keys**

In `messages/en.json`, restructure `dashboard.today` from flat string to object, and nest meal list keys.

Also ensure `dashboard.fetchError` exists (may already be added if Chunk 1 merged first — if not, add it):
```json
"fetchError": "Something went wrong loading data"
```

Add these keys:

```json
{
  "today": {
    "title": "Today",
    "protein": "Protein",
    "carbs": "Carbs",
    "fat": "Fat",
    "mealList": {
      "recentMeals": "Recent meals",
      "logged": "{count} logged",
      "noMealsToday": "No meals logged today"
    }
  }
}
```

Remove old flat keys: `"today": "Today"`, `"carbs": "Carbs"`, `"fat": "Fat"`, `"noMealsToday": "..."`, `"recentMeals": "..."`. **Important:** Do NOT remove `"protein": "Protein"` — it's shared by ProteinConsistencyCard (Chunk 1) via `useTranslations('dashboard')`.

Also ensure `dashboard.fetchError` exists in both en.json and vi.json (may already be present if Chunk 1 merged first — add if missing):
- EN: `"fetchError": "Something went wrong loading data"`
- VI: `"fetchError": "Đã xảy ra lỗi khi tải dữ liệu"`

- [ ] **Step 2: Add Vietnamese keys**

```json
{
  "today": {
    "title": "Hôm nay",
    "protein": "Đạm",
    "carbs": "Carb",
    "fat": "Chất béo",
    "mealList": {
      "recentMeals": "Bữa ăn gần đây",
      "logged": "{count} đã ghi",
      "noMealsToday": "Chưa ghi nhận bữa ăn nào hôm nay"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/vi.json
git commit -m "feat(i18n): add dashboard.today section translations"
```

---

### Task 3.4: Wire TodaySection to server action + i18n

**Files:**
- Modify: `components/dashboard/today/today-section.tsx`
- Modify: `components/dashboard/today/meal-list.tsx`
- Modify: `components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Rewrite TodaySection**

`components/dashboard/today/today-section.tsx`:
- Remove props (nutrition, meals)
- Add `useQuery('dashboard-today')` → `getTodayData()`
- Update `useTranslations('dashboard')` → `useTranslations('dashboard.today')` for macro labels
- Add loading skeleton

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalorieRing } from '@/components/shared/calorie-ring';
import { MacroBars } from '@/components/shared/macro-bars';
import { getTodayData } from '@/lib/domain/dashboard/actions/today';
import { MealList } from './meal-list';

export function TodaySection() {
  const t = useTranslations('dashboard.today');
  const td = useTranslations('dashboard');

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: () => getTodayData(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (error) toast.error(td('fetchError'));
  }, [error, td]);

  if (isLoading || !data) {
    return <TodaySectionSkeleton />;
  }

  const { nutrition, meals } = data;

  const macroItems = [
    {
      label: t('protein'),
      current: nutrition.protein.current,
      target: nutrition.protein.target,
      color: 'var(--kallo-macro-protein)',
      unit: 'g' as const,
    },
    {
      label: t('carbs'),
      current: nutrition.carbs.current,
      target: nutrition.carbs.target,
      color: 'var(--kallo-macro-carbs)',
      unit: 'g' as const,
    },
    {
      label: t('fat'),
      current: nutrition.fat.current,
      target: nutrition.fat.target,
      color: 'var(--kallo-macro-fat)',
      unit: 'g' as const,
    },
  ];

  return (
    <div className="flex h-full items-stretch gap-5">
      <div className="flex flex-1 items-center gap-5">
        <CalorieRing current={nutrition.calories.current} target={nutrition.calories.target} />
        <MacroBars items={macroItems} />
      </div>
      <div className="w-[36%] min-w-0 rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <MealList meals={meals} />
      </div>
    </div>
  );
}

function TodaySectionSkeleton() {
  return (
    <div className="flex h-full items-stretch gap-5 animate-pulse">
      <div className="flex flex-1 items-center gap-5">
        <div className="h-24 w-24 rounded-full bg-kallo-hover" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-3 w-20 rounded bg-kallo-hover" />
          <div className="h-2 w-full rounded bg-kallo-hover" />
          <div className="h-3 w-16 rounded bg-kallo-hover" />
          <div className="h-2 w-full rounded bg-kallo-hover" />
          <div className="h-3 w-14 rounded bg-kallo-hover" />
          <div className="h-2 w-full rounded bg-kallo-hover" />
        </div>
      </div>
      <div className="w-[36%] rounded-2xl bg-kallo-hover" />
    </div>
  );
}
```

- [ ] **Step 2: i18n MealList**

In `components/dashboard/today/meal-list.tsx`:
- Change `useTranslations('dashboard')` → `useTranslations('dashboard.today.mealList')`
- Replace `{meals.length} logged` (line 28) with `t('logged', { count: meals.length })`
- Update `t('noMealsToday')` and `t('recentMeals')` — keys stay same but namespace changes

- [ ] **Step 3: Clean up DashboardShell**

In `components/dashboard/dashboard-shell.tsx`:
- Remove `nutrition` and `meals` query blocks (lines 81-93 in original)
- Remove `getNutritionData`, `getMealsToday` imports from mock-data
- Simplify `<TodaySection />` call — no more props
- The `<SectionHeader title={t('today')} />` should update to `t('today.title')` since `today` is now an object

- [ ] **Step 4: Verify build + lint**

```bash
cd /Users/khoivo/Documents/kallo-today-section
bunx @biomejs/biome check --write .
bun --env-file=.env.local vitest run lib/dashboard/__tests__/today-action.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(dashboard): wire TodaySection to real data + i18n

- TodaySection owns useQuery → getTodayData()
- MealList count string i18n'd with ICU placeholder
- Macro labels use dashboard.today namespace
- DashboardShell no longer fetches nutrition/meals"
```

---

## Post-Implementation: Merge & Cleanup

After all 3 worktrees are complete and merged to main:

- [ ] Delete `components/dashboard/mock-data.ts`
- [ ] Remove any remaining mock-data imports
- [ ] Verify `DashboardShell` has zero mock imports and zero data-fetching queries
- [ ] Run full lint: `bunx @biomejs/biome check .`
- [ ] Run full tests: `bun --env-file=.env.local vitest run`
- [ ] Clean up worktrees:
  ```bash
  git worktree remove ../kallo-current-section
  git worktree remove ../kallo-progress-section
  git worktree remove ../kallo-today-section
  ```
