# Logging Responsive Timeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the logging page responsive with a polished mobile date rail, refined desktop timeline sidebar, stable `?date=` URL sync, and bottom-tab-safe mobile behavior.

**Architecture:** `LoggingShell` becomes the single owner of timeline server state and URL state. Timeline date utilities become pure tested helpers, while desktop and mobile timeline controls become presentational components that receive a shared `TimelineState` interface. Mobile uses an in-page horizontal rail plus inline history panel, not a drawer or sheet, so the global bottom tab bar remains separate.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, next-intl, Vitest, Testing Library, Tailwind CSS 4, lucide-react, Biome 2.4.2.

---

## References

- Spec: `docs/superpowers/specs/2026-05-03-logging-responsive-timeline-design.md`
- Current shell: `components/logging/logging-shell.tsx`
- Current sidebar: `components/logging/sidebar/timeline-sidebar.tsx`
- Current page search params: `app/[locale]/(app)/logging/page.tsx`
- App shell bottom bar: `components/app/bottom-tab-bar.tsx`
- Query action: `lib/actions/meals.ts#loadMealDates`
- Test setup: `vitest.setup.ts`
- Required pre-coding guidance: @vercel-react-best-practices, @web-design-guidelines

## File structure

- Create: `components/logging/sidebar/timeline-utils.ts`
  - Pure date helpers, grouping, rail algorithm, and shared types.
- Create: `components/logging/sidebar/timeline-utils.test.ts`
  - Unit tests for date grouping, today/selected insertion, rail ordering, and hidden-date detection.
- Create: `components/logging/sidebar/timeline-types.ts`
  - Shared presentational prop interfaces if `timeline-utils.ts` starts to mix UI types with helper logic.
  - Prefer this split if utility file would exceed about 220 lines.
- Create: `components/logging/sidebar/timeline-date-button.tsx`
  - Shared date button primitive for desktop and mobile.
- Create: `components/logging/sidebar/mobile-timeline-rail.tsx`
  - Mobile-only horizontal rail and inline history toggle.
- Create: `components/logging/sidebar/mobile-timeline-expanded-panel.tsx`
  - Inline older-history panel. Separate from the rail so history grouping and
    open/close behavior stay independently understandable.
- Create: `components/logging/sidebar/mobile-timeline-rail.test.tsx`
  - Component tests for mobile date selection, active state, hidden-history expansion, loading, error, and retry.
- Modify: `components/logging/sidebar/timeline-sidebar.tsx`
  - Convert to presentational desktop sidebar, use shared utilities and date button, add loading/error/empty states, refine UI.
- Create: `components/logging/sidebar/timeline-sidebar.test.tsx`
  - Component tests for desktop expanded states, active date, retry fallback, and accessible labels.
- Modify: `components/logging/logging-shell.tsx`
  - Own `meal-dates` query, derive timeline state, render mobile and desktop controls, sync `?date=`, preserve and clear `?meal=`.
- Create: `components/logging/logging-shell.test.tsx`
  - Tests for query ownership, URL updates, URL reconciliation, prefill cleanup, and responsive control rendering.
- Modify: `components/logging/feed/feed-area.tsx`
  - Notify `LoggingShell` only after `initialMeal` has actually been applied.
- Create: `app/[locale]/(app)/logging/search-params.ts`
  - Testable parser for `meal` and `date` query params.
- Create: `app/[locale]/(app)/logging/search-params.test.ts`
  - Unit tests for valid and invalid logging search params.
- Modify: `app/[locale]/(app)/logging/page.tsx`
  - Use the search-param parser, pass `initialDate` to `LoggingShell`.
- Modify: `messages/en.json` and `messages/vi.json`
  - Add any missing timeline labels for retry, history, loading, empty history, and month controls.

## Implementation notes

- Use `bun run test ...` for file-scoped Vitest runs.
- Use pinned Biome: `bunx @biomejs/biome@2.4.2 check .`
- Do not run `bun dev`, `bun run build`, or `bun start` unless explicitly requested.
- Do not edit `components/ui`.
- Use `Intl.DateTimeFormat` for date labels.
- Do not use `transition-all`.
- All icon-only buttons need `aria-label`.
- All date actions are buttons with `aria-current="date"` on the selected date.
- Mobile controls need at least 44px touch height and `touch-action: manipulation`.
- Commits must use conventional commit format and include the required co-author trailer.

---

## Chunk 1: Pure timeline utilities

### Task 1: Extract timeline utilities with TDD

**Files:**
- Create: `components/logging/sidebar/timeline-utils.test.ts`
- Create: `components/logging/sidebar/timeline-utils.ts`
- Later modify: `components/logging/sidebar/timeline-sidebar.tsx`

- [ ] **Step 1: Write failing tests for existing and new date behavior**

Create `components/logging/sidebar/timeline-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildAllTimelineDates,
  buildMobileRailDates,
  formatCompactDayLabel,
  formatDayLabel,
  getSelectedMonthKey,
  getSelectedWeekKey,
  groupByMonth,
  todayDateString,
  weekOfMonth,
} from './timeline-utils';

describe('timeline-utils', () => {
  it('formats day labels with Intl and locale-aware weekday names', () => {
    expect(formatDayLabel('2026-05-03', 'en')).toMatch(/Sun/);
    expect(formatCompactDayLabel('2026-05-03', 'en')).toMatch(/Sun/);
  });

  it('groups dates into month and week buckets', () => {
    expect(groupByMonth(['2026-05-03', '2026-05-10'])).toEqual([
      {
        key: '05-2026',
        month: 5,
        year: 2026,
        weeks: [
          {
            key: '05-2026-w1',
            weekNumber: 1,
            days: ['2026-05-03'],
          },
          {
            key: '05-2026-w2',
            weekNumber: 2,
            days: ['2026-05-10'],
          },
        ],
      },
    ]);
  });

  it('derives selected month and week keys', () => {
    expect(getSelectedMonthKey('2026-05-03')).toBe('05-2026');
    expect(getSelectedWeekKey('2026-05-03')).toBe('05-2026-w1');
    expect(weekOfMonth('2026-05-31')).toBe(5);
  });

  it('builds all timeline dates from saved dates plus today and selected date', () => {
    expect(
      buildAllTimelineDates({
        dates: ['2026-05-01', '2026-05-03', '2026-05-01'],
        today: '2026-05-02',
        selectedDate: '2026-04-29',
      })
    ).toEqual(['2026-05-03', '2026-05-02', '2026-05-01', '2026-04-29']);
  });

  it('keeps selected date and today in the mobile rail even when limiting dates', () => {
    const allDates = [
      '2026-05-10',
      '2026-05-09',
      '2026-05-08',
      '2026-05-07',
      '2026-05-06',
      '2026-05-05',
      '2026-05-04',
      '2026-05-03',
      '2026-05-02',
      '2026-05-01',
    ];

    const result = buildMobileRailDates({
      allDates,
      selectedDate: '2026-05-01',
      today: '2026-05-10',
      limit: 4,
    });

    expect(result.mobileDates).toContain('2026-05-01');
    expect(result.mobileDates).toContain('2026-05-10');
    expect(result.mobileDates).toHaveLength(4);
    expect(result.hasHiddenDates).toBe(true);
  });

  it('adds selected date and today to the mobile rail even when missing from allDates', () => {
    const result = buildMobileRailDates({
      allDates: ['2026-05-04', '2026-05-03'],
      selectedDate: '2026-05-01',
      today: '2026-05-10',
      limit: 3,
    });

    expect(result.mobileDates).toContain('2026-05-01');
    expect(result.mobileDates).toContain('2026-05-10');
  });

  it('does not report hidden dates when all dates fit within the limit', () => {
    expect(
      buildMobileRailDates({
        allDates: ['2026-05-03', '2026-05-02'],
        selectedDate: '2026-05-02',
        today: '2026-05-03',
        limit: 14,
      }).hasHiddenDates
    ).toBe(false);
  });

  it('exposes a deterministic today string shape', () => {
    expect(todayDateString()).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/);
    expect(todayDateString(new Date('2026-05-03T12:00:00'))).toBe('2026-05-03');
  });
});
```

- [ ] **Step 2: Run the utility test to verify it fails**

Run:

```bash
bun run test components/logging/sidebar/timeline-utils.test.ts
```

Expected: FAIL because `timeline-utils.ts` does not exist.

- [ ] **Step 3: Implement pure utilities**

Create `components/logging/sidebar/timeline-utils.ts`:

```ts
export interface WeekSection {
  key: string;
  weekNumber: number;
  days: string[];
}

export interface MonthSection {
  key: string;
  month: number;
  year: number;
  weeks: WeekSection[];
}

export interface BuildAllTimelineDatesInput {
  dates: string[];
  today: string;
  selectedDate: string;
}

export interface BuildMobileRailDatesInput {
  allDates: string[];
  selectedDate: string;
  today: string;
  limit: number;
}

export interface MobileRailDates {
  mobileDates: string[];
  hasHiddenDates: boolean;
}

export function todayDateString(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export function formatDayLabel(dateStr: string, locale: string): string {
  const date = toLocalDate(dateStr);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
  }).format(date);
  const numeric = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
  }).format(date);
  return `${weekday} - ${numeric}`;
}

export function formatCompactDayLabel(dateStr: string, locale: string): string {
  const date = toLocalDate(dateStr);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(date);
}

export function weekOfMonth(dateStr: string): number {
  const day = Number.parseInt(dateStr.split('-')[2] ?? '1', 10);
  return Math.ceil(day / 7);
}

export function getSelectedMonthKey(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  return `${month}-${year}`;
}

export function getSelectedWeekKey(dateStr: string): string {
  return `${getSelectedMonthKey(dateStr)}-w${weekOfMonth(dateStr)}`;
}

export function buildAllTimelineDates({
  dates,
  today,
  selectedDate,
}: BuildAllTimelineDatesInput): string[] {
  const set = new Set(dates);
  set.add(today);
  set.add(selectedDate);
  return Array.from(set).sort().reverse();
}

export function groupByMonth(dates: string[]): MonthSection[] {
  const monthMap = new Map<string, Map<number, string[]>>();

  for (const date of dates) {
    const monthKey = getSelectedMonthKey(date);
    const weekNumber = weekOfMonth(date);
    const weekMap = monthMap.get(monthKey) ?? new Map<number, string[]>();
    const days = weekMap.get(weekNumber) ?? [];
    days.push(date);
    weekMap.set(weekNumber, days);
    monthMap.set(monthKey, weekMap);
  }

  return Array.from(monthMap.entries()).map(([monthKey, weekMap]) => {
    const [month, year] = monthKey.split('-');
    return {
      key: monthKey,
      month: Number.parseInt(month ?? '1', 10),
      year: Number.parseInt(year ?? '1970', 10),
      weeks: Array.from(weekMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([weekNumber, days]) => ({
          key: `${monthKey}-w${weekNumber}`,
          weekNumber,
          days,
        })),
    };
  });
}

function distanceFromSelected(date: string, selectedDate: string): number {
  return Math.abs(toLocalDate(date).getTime() - toLocalDate(selectedDate).getTime());
}

export function buildMobileRailDates({
  allDates,
  selectedDate,
  today,
  limit,
}: BuildMobileRailDatesInput): MobileRailDates {
  const required = new Set([selectedDate, today]);
  const unique = Array.from(new Set([...allDates, ...required]));
  const remaining = unique
    .filter((date) => !required.has(date))
    .sort((a, b) => {
      const byDistance =
        distanceFromSelected(a, selectedDate) - distanceFromSelected(b, selectedDate);
      if (byDistance !== 0) return byDistance;
      return b.localeCompare(a);
    });

  const selected = Array.from(required);
  const effectiveLimit = Math.max(limit, selected.length);
  const capped = [...selected, ...remaining].slice(0, effectiveLimit);

  return {
    mobileDates: Array.from(new Set(capped)).sort().reverse(),
    hasHiddenDates: unique.length > new Set(capped).size,
  };
}
```

`limit` is treated as a minimum of the required date count because selected date
and Today must both be preserved even if a smaller limit is passed.

- [ ] **Step 4: Run the utility test to verify it passes**

Run:

```bash
bun run test components/logging/sidebar/timeline-utils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run Biome on utility files**

Run:

```bash
bunx @biomejs/biome@2.4.2 check components/logging/sidebar/timeline-utils.ts components/logging/sidebar/timeline-utils.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit utility extraction**

Run:

```bash
git add components/logging/sidebar/timeline-utils.ts components/logging/sidebar/timeline-utils.test.ts
git commit -m "feat: add timeline date utilities" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: one commit with utility tests and implementation.

---

## Chunk 2: Presentational timeline controls

### Task 2: Add shared date button primitive

**Files:**
- Create: `components/logging/sidebar/timeline-date-button.tsx`
- Test indirectly through mobile and desktop component tests.

- [ ] **Step 1: Create the shared date button primitive**

Create `components/logging/sidebar/timeline-date-button.tsx`:

```tsx
'use client';

import { cn } from '@/lib/utils';

interface TimelineDateButtonProps {
  date: string;
  label: string;
  isActive: boolean;
  isToday?: boolean;
  hasMeal?: boolean;
  variant: 'desktop' | 'mobile';
  onSelectDate: (date: string) => void;
}

export function TimelineDateButton({
  date,
  label,
  isActive,
  isToday = false,
  hasMeal = false,
  variant,
  onSelectDate,
}: TimelineDateButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelectDate(date)}
      aria-current={isActive ? 'date' : undefined}
      data-today={isToday ? 'true' : 'false'}
      data-has-meal={hasMeal ? 'true' : 'false'}
      className={cn(
        'group/date relative touch-manipulation rounded-xl font-medium font-sans-display tracking-tight transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface active:scale-[0.98]',
        variant === 'mobile'
          ? 'flex min-h-11 min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-2 text-[11px]'
          : 'flex min-h-10 flex-1 items-center px-3 py-2 text-sm',
        isActive
          ? 'bg-kallo-btn text-white shadow-kallo-btn/15 shadow-sm'
          : isToday
            ? 'bg-kallo-accent/35 text-kallo-text hover:bg-kallo-accent/50'
            : 'text-kallo-text-muted hover:bg-kallo-hover/50 hover:text-kallo-text'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {hasMeal && (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isActive ? 'bg-white/80' : 'bg-kallo-accent'
          )}
        />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Run Biome on the new file**

Run:

```bash
bunx @biomejs/biome@2.4.2 check components/logging/sidebar/timeline-date-button.tsx
```

Expected: PASS.

### Task 3: Build mobile timeline rail and tests

**Files:**
- Create: `components/logging/sidebar/mobile-timeline-rail.tsx`
- Create: `components/logging/sidebar/mobile-timeline-expanded-panel.tsx`
- Create: `components/logging/sidebar/mobile-timeline-rail.test.tsx`

- [ ] **Step 1: Write failing mobile rail tests**

Create `components/logging/sidebar/mobile-timeline-rail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileTimelineRail } from './mobile-timeline-rail';

const baseProps = {
  dates: ['2026-05-03', '2026-05-01'],
  allDates: ['2026-05-03', '2026-05-02', '2026-05-01'],
  mobileDates: ['2026-05-03', '2026-05-02'],
  hasHiddenDates: true,
  today: '2026-05-03',
  selectedDate: '2026-05-02',
  isPending: false,
  isError: false,
  onRetry: vi.fn(),
  onSelectDate: vi.fn(),
};

describe('MobileTimelineRail', () => {
  it('marks the selected date as current and calls onSelectDate', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(<MobileTimelineRail {...baseProps} onSelectDate={onSelectDate} />);

    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent(/May 2|2/);

    await user.click(screen.getByRole('button', { name: /May 3|Sun|today/i }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-05-03');
  });

  it('opens older history inline when hidden dates exist', async () => {
    const user = userEvent.setup();
    render(<MobileTimelineRail {...baseProps} />);

    const historyButton = screen.getByRole('button', { name: /history/i });
    expect(historyButton).toHaveAttribute('aria-expanded', 'false');
    expect(historyButton).toHaveAttribute('aria-controls');

    await user.click(historyButton);

    expect(historyButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /May 1|Fri|1/i })).toBeInTheDocument();
  });

  it('closes older history after selecting a date', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(<MobileTimelineRail {...baseProps} onSelectDate={onSelectDate} />);

    await user.click(screen.getByRole('button', { name: /history/i }));
    await user.click(screen.getByRole('button', { name: /May 1|Fri|1/i }));

    expect(onSelectDate).toHaveBeenCalledWith('2026-05-01');
    expect(
      screen.queryByRole('navigation', { name: /history/i })
    ).not.toBeInTheDocument();
  });

  it('shows meal indicators only for dates returned by loadMealDates', () => {
    render(<MobileTimelineRail {...baseProps} />);

    expect(screen.getByRole('button', { name: /May 3|Sun|today/i })).toHaveAttribute(
      'data-has-meal',
      'true'
    );
    expect(screen.getByRole('button', { current: 'date' })).toHaveAttribute(
      'data-has-meal',
      'false'
    );
  });

  it('keeps today selectable and explains empty history', () => {
    render(
      <MobileTimelineRail
        {...baseProps}
        dates={[]}
        allDates={['2026-05-03']}
        mobileDates={['2026-05-03']}
        hasHiddenDates={false}
        selectedDate="2026-05-03"
      />
    );

    expect(screen.getByRole('button', { current: 'date' })).toBeInTheDocument();
    expect(screen.getByText('noPreviousMeals')).toBeInTheDocument();
  });

  it('shows skeleton chips while loading', () => {
    render(<MobileTimelineRail {...baseProps} isPending={true} />);

    expect(screen.getByTestId('mobile-timeline-skeleton')).toBeInTheDocument();
  });

  it('keeps local dates usable and exposes retry when date history fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<MobileTimelineRail {...baseProps} isError={true} onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { current: 'date' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the mobile rail test to verify it fails**

Run:

```bash
bun run test components/logging/sidebar/mobile-timeline-rail.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `MobileTimelineRail`**

Create `components/logging/sidebar/mobile-timeline-rail.tsx` and
`components/logging/sidebar/mobile-timeline-expanded-panel.tsx`.

Implementation requirements:

- Props:

```ts
interface MobileTimelineRailProps {
  dates: string[];
  allDates: string[];
  mobileDates: string[];
  hasHiddenDates: boolean;
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}
```

- Use `useLocale()` and `useTranslations('logging.timelineSidebar')`.
- Use `TimelineDateButton` for each chip.
- Use `formatCompactDayLabel`, `groupByMonth`, and `formatDayLabel`.
- Maintain local `historyOpen` state.
- Render root as `div className="md:hidden"`.
- Date chips must sit in a horizontal scroll container with `overflow-x-auto`,
  `overscroll-x-contain`, and no page-level horizontal overflow.
- Pass `hasMeal={dates.includes(date)}` to every `TimelineDateButton`.
- Add `data-has-meal={hasMeal ? 'true' : 'false'}` in `TimelineDateButton` for
  testability and styling hooks.
- History toggle button must include `aria-expanded={historyOpen}` and
  `aria-controls="mobile-timeline-history"` when `hasHiddenDates` is true.
- Empty history state must render `t('noPreviousMeals')` while keeping Today and
  the selected date selectable.
- Loading state:

```tsx
<div data-testid="mobile-timeline-skeleton" className="flex gap-2 overflow-hidden px-1 py-2">
  {Array.from({ length: 4 }).map((_, index) => (
    <div
      key={index}
      className="h-11 w-20 shrink-0 animate-pulse rounded-xl bg-kallo-border/35"
    />
  ))}
</div>
```

- Error state keeps chips visible and includes:

```tsx
<button type="button" onClick={onRetry}>{t('retryDates')}</button>
```

- Inline history panel:
  - Implement in `MobileTimelineExpandedPanel`, not inline inside the rail.
  - Props match the spec interface: timeline state, `open`, and `onOpenChange`.
  - `nav id="mobile-timeline-history" aria-label={t('historyNavigationLabel')}`.
  - Render month/week/date groups with semantic `ul`, `li`, and `button`
    elements inside the `nav`.
  - Month and week groups from `groupByMonth(allDates)`.
  - Close after selecting a date by calling `onSelectDate(date)` and
    `onOpenChange(false)`.
  - Only render from the rail when `historyOpen && hasHiddenDates`.

- Add new message keys if missing:
  - `logging.timelineSidebar.history`
  - `logging.timelineSidebar.historyNavigationLabel`
  - `logging.timelineSidebar.retryDates`
  - `logging.timelineSidebar.loadingDates`
  - `logging.timelineSidebar.noPreviousMeals`

- [ ] **Step 4: Run mobile rail test to verify it passes**

Run:

```bash
bun run test components/logging/sidebar/mobile-timeline-rail.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run Biome on mobile timeline files**

Run:

```bash
bunx @biomejs/biome@2.4.2 check components/logging/sidebar/mobile-timeline-rail.tsx components/logging/sidebar/mobile-timeline-expanded-panel.tsx components/logging/sidebar/mobile-timeline-rail.test.tsx components/logging/sidebar/timeline-date-button.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit mobile rail**

Run:

```bash
git add components/logging/sidebar/mobile-timeline-rail.tsx components/logging/sidebar/mobile-timeline-expanded-panel.tsx components/logging/sidebar/mobile-timeline-rail.test.tsx components/logging/sidebar/timeline-date-button.tsx messages/en.json messages/vi.json
git commit -m "feat: add mobile logging timeline rail" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: one commit with the mobile rail and messages.

### Task 4: Refine desktop timeline sidebar as a presentational component

**Files:**
- Modify: `components/logging/sidebar/timeline-sidebar.tsx`
- Create: `components/logging/sidebar/timeline-sidebar.test.tsx`

- [ ] **Step 1: Write failing desktop sidebar tests**

Create `components/logging/sidebar/timeline-sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimelineSidebar } from './timeline-sidebar';

const baseProps = {
  dates: ['2026-05-03', '2026-05-01'],
  allDates: ['2026-05-03', '2026-05-02', '2026-05-01'],
  today: '2026-05-03',
  selectedDate: '2026-05-02',
  isPending: false,
  isError: false,
  onRetry: vi.fn(),
  onSelectDate: vi.fn(),
};

describe('TimelineSidebar', () => {
  it('renders month and week controls with expanded state', () => {
    render(<TimelineSidebar {...baseProps} />);

    expect(screen.getByRole('navigation', { name: 'navigationLabel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5\\/2026|May/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: /week/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('selects a date from the desktop sidebar', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(<TimelineSidebar {...baseProps} onSelectDate={onSelectDate} />);

    await user.click(screen.getByRole('button', { name: /May 1|Fri|1/i }));

    expect(onSelectDate).toHaveBeenCalledWith('2026-05-01');
  });

  it('shows retry affordance without hiding local dates when history fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<TimelineSidebar {...baseProps} isError={true} onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { current: 'date' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the sidebar test to verify it fails**

Run:

```bash
bun run test components/logging/sidebar/timeline-sidebar.test.tsx
```

Expected: FAIL because props and behavior are not refactored yet.

- [ ] **Step 3: Refactor and polish `TimelineSidebar`**

Modify `components/logging/sidebar/timeline-sidebar.tsx`:

- Remove `useQuery` and `loadMealDates` imports.
- Import shared helpers from `timeline-utils.ts`.
- Import `TimelineDateButton`.
- Change props to:

```ts
interface TimelineSidebarProps {
  dates: string[];
  allDates: string[];
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}
```

- Keep month/week expansion state and auto-expand selected month/week.
- Root class should be hidden on mobile and visually refined:

```tsx
className="hidden h-full w-[232px] shrink-0 flex-col overflow-hidden rounded-2xl border border-kallo-border/60 bg-white/70 shadow-kallo-text/[0.03] shadow-sm md:flex"
```

- Inner scroll region:

```tsx
className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
```

- Use `TimelineDateButton` for dates.
- Pass `hasMeal={dates.includes(date)}` for logged-date indicators.
- Add `focus-visible` rings to month/week buttons.
- Add explicit `transition-[background-color,color,transform]`, not `transition-all`.
- Loading skeleton: 3 month rows and 5 date rows.
- Error inline retry with `t('retryDates')`.
- Empty history copy with `noPreviousMeals`.

- [ ] **Step 4: Run desktop sidebar test to verify it passes**

Run:

```bash
bun run test components/logging/sidebar/timeline-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run Biome on desktop sidebar files**

Run:

```bash
bunx @biomejs/biome@2.4.2 check components/logging/sidebar/timeline-sidebar.tsx components/logging/sidebar/timeline-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run all timeline component tests**

Run:

```bash
bun run test components/logging/sidebar/timeline-utils.test.ts components/logging/sidebar/mobile-timeline-rail.test.tsx components/logging/sidebar/timeline-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit desktop sidebar refinement**

Run:

```bash
git add components/logging/sidebar/timeline-sidebar.tsx components/logging/sidebar/timeline-sidebar.test.tsx
git commit -m "feat: refine logging timeline sidebar" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: one commit with desktop sidebar refactor and tests.

---

## Chunk 3: Logging shell query ownership, URL sync, and QA

### Task 5: Parse `?date=` in the logging page

**Files:**
- Create: `app/[locale]/(app)/logging/search-params.ts`
- Create: `app/[locale]/(app)/logging/search-params.test.ts`
- Modify: `app/[locale]/(app)/logging/page.tsx`

- [ ] **Step 1: Write failing search-param parser tests**

Create `app/[locale]/(app)/logging/search-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLoggingSearchParams } from './search-params';

describe('parseLoggingSearchParams', () => {
  it('accepts valid meal and date params', () => {
    expect(
      parseLoggingSearchParams({ meal: 'phở bò', date: '2026-05-03' })
    ).toEqual({ meal: 'phở bò', date: '2026-05-03' });
  });

  it('drops invalid date params while preserving valid meal params', () => {
    expect(parseLoggingSearchParams({ meal: 'bún', date: '03-05-2026' })).toEqual({
      meal: 'bún',
      date: undefined,
    });
  });

  it('drops empty meal params', () => {
    expect(parseLoggingSearchParams({ meal: '', date: '2026-05-03' })).toEqual({
      meal: undefined,
      date: '2026-05-03',
    });
  });

  it('drops overlong meal params', () => {
    expect(
      parseLoggingSearchParams({
        meal: 'x'.repeat(301),
        date: '2026-05-03',
      })
    ).toEqual({
      meal: undefined,
      date: '2026-05-03',
    });
  });
});
```

- [ ] **Step 2: Run parser test to verify it fails**

Run:

```bash
bun run test app/[locale]/\(app\)/logging/search-params.test.ts
```

Expected: FAIL because parser does not exist.

- [ ] **Step 3: Add date param parsing helper**

Create `app/[locale]/(app)/logging/search-params.ts`:

```ts
import { z } from 'zod';

const loggingSearchParamsSchema = z.object({
  meal: z.string().trim().min(1).max(300).optional(),
  date: z
    .string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/)
    .optional(),
});

export interface LoggingSearchParams {
  meal?: string;
  date?: string;
}

export function parseLoggingSearchParams(
  rawParams: Record<string, string | undefined>
): LoggingSearchParams {
  const parsed = loggingSearchParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    const mealParsed = loggingSearchParamsSchema
      .pick({ meal: true })
      .safeParse(rawParams);
    const dateParsed = loggingSearchParamsSchema
      .pick({ date: true })
      .safeParse(rawParams);
    return {
      meal: mealParsed.success ? mealParsed.data.meal : undefined,
      date: dateParsed.success ? dateParsed.data.date : undefined,
    };
  }
  return parsed.data;
}
```

- [ ] **Step 4: Wire parser into page**

Modify `app/[locale]/(app)/logging/page.tsx`:

```ts
import { parseLoggingSearchParams } from './search-params';

searchParams: Promise<{ meal?: string; date?: string }>;
```

Pass to shell:

```tsx
return <LoggingShell profile={profile} initialMeal={meal} initialDate={date} />;
```

- [ ] **Step 5: Run parser test to verify it passes**

Run:

```bash
bun run test app/[locale]/\(app\)/logging/search-params.test.ts
```

Expected: PASS.

### Task 6: Move query ownership and URL sync into `LoggingShell`

**Files:**
- Modify: `components/logging/logging-shell.tsx`
- Create: `components/logging/logging-shell.test.tsx`
- Modify: `components/logging/feed/feed-area.tsx`

- [ ] **Step 1: Write failing shell tests**

Create `components/logging/logging-shell.test.tsx`.

Test strategy:

- Mock `FeedArea`, `TimelineSidebar`, `MobileTimelineRail`, and `loadMealDates`.
- Mock `@/i18n/navigation` locally if the global mock does not expose stable spies.
- Wrap with `QueryClientProvider` if using real `useQuery`; otherwise mock `useQuery` only for URL-specific tests.

Required test cases:

```tsx
it('initializes selectedDate from initialDate and renders timeline controls');
it('passes one shared date state to mobile and desktop timeline controls');
it('updates ?date= with router.replace and scroll false when date changes');
it('does not clear ?meal= until FeedArea reports the prefill was applied');
it('clears ?meal= after prefill while preserving ?date=');
it('reconciles selectedDate when searchParams date changes externally');
```

Example core assertion:

```tsx
expect(replaceMock).toHaveBeenCalledWith('/logging?date=2026-05-01', {
  scroll: false,
});
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run:

```bash
bun run test components/logging/logging-shell.test.tsx
```

Expected: FAIL because query ownership and URL sync are not implemented.

- [ ] **Step 3: Implement shell query ownership**

Modify `components/logging/logging-shell.tsx`:

- Import:

```ts
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from '@/i18n/navigation';
import { MobileTimelineRail } from '@/components/logging/sidebar/mobile-timeline-rail';
import {
  buildAllTimelineDates,
  buildMobileRailDates,
  todayDateString,
} from '@/components/logging/sidebar/timeline-utils';
import { loadMealDates } from '@/lib/actions/meals';
import { usePrefetchDates } from '@/hooks/use-prefetch-dates';
```

- Add constant:

```ts
const MOBILE_RAIL_DATE_LIMIT = 14;
```

- Props:

```ts
interface LoggingShellProps {
  profile: LoggingProfile;
  initialMeal?: string;
  initialDate?: string;
}
```

- Use lazy state:

```ts
const today = useMemo(() => todayDateString(), []);
const [selectedDate, setSelectedDate] = useState(() => initialDate ?? today);
```

- Query:

```ts
const timezoneOffset = new Date().getTimezoneOffset();
const {
  data: dates = [],
  isPending,
  isError,
  refetch,
} = useQuery({
  queryKey: ['meal-dates', profile.userId, timezoneOffset],
  queryFn: () => loadMealDates({ timezoneOffset }),
  staleTime: 60_000,
});
```

- Keep adjacent-date prefetching:

```ts
usePrefetchDates(selectedDate);
```

- Derive:

```ts
const allDates = useMemo(
  () => buildAllTimelineDates({ dates, today, selectedDate }),
  [dates, selectedDate, today]
);
const { mobileDates, hasHiddenDates } = useMemo(
  () =>
    buildMobileRailDates({
      allDates,
      selectedDate,
      today,
      limit: MOBILE_RAIL_DATE_LIMIT,
    }),
  [allDates, selectedDate, today]
);
```

- URL helper:

```ts
const updateSearchParams = useCallback(
  (nextDate: string, options?: { clearMeal?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', nextDate);
    if (options?.clearMeal) params.delete('meal');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  },
  [pathname, router, searchParams]
);
```

- Date selection:

```ts
const handleSelectDate = useCallback(
  (date: string) => {
    setSelectedDate(date);
    updateSearchParams(date);
  },
  [updateSearchParams]
);
```

- Reconcile external URL date:

```ts
useEffect(() => {
  const urlDate = searchParams.get('date');
  if (urlDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(urlDate)) {
    setSelectedDate(urlDate);
  }
}, [searchParams]);
```

If `?date=` is removed through browser back/forward, keep the current
`selectedDate`. Only valid URL dates override local state.

- Add prefill-applied callback:

```ts
const handleInitialMealApplied = useCallback(() => {
  updateSearchParams(selectedDate, { clearMeal: true });
}, [selectedDate, updateSearchParams]);
```

- Modify `FeedAreaProps`:

```ts
interface FeedAreaProps {
  selectedDate: string;
  profile: LoggingProfile;
  initialMeal?: string;
  onInitialMealApplied?: () => void;
}
```

- In `FeedArea`, call the callback only after the existing prefill effect sets
  text and focus:

```ts
useEffect(() => {
  if (!initialMeal || lastPrefilledMealRef.current === initialMeal) return;
  lastPrefilledMealRef.current = initialMeal;
  inputRef.current?.setText(initialMeal);
  inputRef.current?.focus();
  onInitialMealApplied?.();
}, [initialMeal, onInitialMealApplied]);
```

- Render:

```tsx
const timelineState = {
  dates,
  allDates,
  today,
  selectedDate,
  isPending,
  isError,
  onRetry: () => {
    void refetch();
  },
  onSelectDate: handleSelectDate,
};

return (
  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
    <MobileTimelineRail
      {...timelineState}
      mobileDates={mobileDates}
      hasHiddenDates={hasHiddenDates}
    />
    <TimelineSidebar {...timelineState} />
    <FeedArea
      selectedDate={selectedDate}
      profile={profile}
      initialMeal={initialMeal}
      onInitialMealApplied={initialMeal ? handleInitialMealApplied : undefined}
    />
  </div>
);
```

- [ ] **Step 4: Run shell tests to verify they pass**

Run:

```bash
bun run test components/logging/logging-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run logging timeline test group**

Run:

```bash
bun run test components/logging/logging-shell.test.tsx components/logging/sidebar/timeline-utils.test.ts components/logging/sidebar/mobile-timeline-rail.test.tsx components/logging/sidebar/timeline-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit shell ownership and URL sync**

Run:

```bash
git add app/[locale]/\(app\)/logging/page.tsx app/[locale]/\(app\)/logging/search-params.ts app/[locale]/\(app\)/logging/search-params.test.ts components/logging/logging-shell.tsx components/logging/logging-shell.test.tsx components/logging/feed/feed-area.tsx
git commit -m "feat: sync logging timeline date state" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: one commit with page parsing, query ownership, URL sync, and tests.

### Task 7: Final responsive polish and verification

**Files:**
- Modify as needed: `components/logging/logging-shell.tsx`
- Modify as needed: `components/logging/sidebar/mobile-timeline-rail.tsx`
- Modify as needed: `components/logging/sidebar/timeline-sidebar.tsx`
- Modify as needed: `components/logging/feed/feed-area.tsx`

- [ ] **Step 1: Audit responsive layout classes**

Check:

- `LoggingShell` uses `flex-col` on mobile and `md:flex-row` on larger screens.
- `MobileTimelineRail` is `md:hidden`.
- `TimelineSidebar` is `hidden md:flex`.
- Feed area has `min-w-0` where needed to prevent horizontal overflow.
- Mobile rail scroll container uses `overflow-x-auto` and no hidden focus traps.
- Meal input remains reachable above the app shell bottom padding.

- [ ] **Step 2: Run Biome auto-fix**

Run:

```bash
bunx @biomejs/biome@2.4.2 check --write components/logging app/[locale]/\(app\)/logging/page.tsx app/[locale]/\(app\)/logging/search-params.ts app/[locale]/\(app\)/logging/search-params.test.ts messages/en.json messages/vi.json
```

Expected: files formatted or no changes.

- [ ] **Step 3: Run focused tests**

Run:

```bash
bun run test components/logging/logging-shell.test.tsx components/logging/sidebar/timeline-utils.test.ts components/logging/sidebar/mobile-timeline-rail.test.tsx components/logging/sidebar/timeline-sidebar.test.tsx components/logging/input/meal-input.test.tsx components/app/bottom-tab-bar.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run repository test suite**

Run:

```bash
bun run test
```

Expected: PASS. If DB-dependent tests fail because local env is missing, rerun with:

```bash
bun --env-file=.env.local vitest run
```

Expected: PASS or document pre-existing environment failure with the exact missing env/error.

- [ ] **Step 5: Run final Biome check**

Run:

```bash
bunx @biomejs/biome@2.4.2 check .
```

Expected: PASS.

- [ ] **Step 6: Commit final polish**

Run:

```bash
git add components/logging app/[locale]/\(app\)/logging/page.tsx app/[locale]/\(app\)/logging/search-params.ts app/[locale]/\(app\)/logging/search-params.test.ts messages/en.json messages/vi.json
git commit -m "fix: polish responsive logging timeline" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: final implementation commit, unless no files changed after checks.

## Manual verification checklist

- [ ] At mobile width, the date rail appears above the feed and the desktop sidebar is absent.
- [ ] At mobile width, the bottom tab bar remains visible and clickable.
- [ ] At mobile width, date chips are touch-sized and horizontally scrollable.
- [ ] The older-history control opens inline below the rail and pushes feed content down.
- [ ] Selecting a date updates the feed and updates `?date=` without jumping scroll.
- [ ] `?meal=` prefill still populates meal input, then clears from the URL while preserving `?date=`.
- [ ] Browser back/forward updates selected date if `?date=` changes.
- [ ] At desktop width, the refined timeline sidebar appears and the mobile rail is absent.
- [ ] Keyboard focus reaches date controls, retry buttons, and meal input in a sensible order.
- [ ] Reduced motion does not leave expanded history inaccessible.
