# Dashboard Structure Redesign

**Date:** 2026-05-03  
**Status:** Approved for spec review  
**Scope:** Dashboard structure, responsive layout, calories entry point, meal visibility, weight trend readability, and adaptive adherence heatmap. No database behavior changes.

## 1. Problem

The dashboard components look strong in isolation, but the page does not yet feel like one connected product surface. Current pain points:

- The page uses a rigid three-row structure that makes sections feel stacked rather than connected.
- Calories remaining is important, but the current card treatment feels visually heavy and disconnected from meal logging.
- Meals already eaten are not close enough to the calories-left number, even though they explain it.
- The meal logging action is appropriate as a floating action on mobile, but too detached on desktop.
- The weight trend chart looks good, but the main insight requires reading axes or hovering.
- The heatmap should prefer a full-year view when space allows, with month headers across week columns.

## 2. Design Goal

Turn the dashboard into a low-burden daily cockpit: a place where users can log meals and weight, quickly understand whether their diet is going right or wrong, and see why without doing visual math.

The page should answer, in order:

1. How much can I still eat today?
2. What have I already logged today?
3. Is my weight trend moving as expected?
4. Does my adherence history explain that trend?

## 3. Register and Visual Stance

This is a product UI. Design should serve the task, not perform for decoration.

- **Color strategy:** restrained. Keep the current warm neutral surface, dark text, and existing accent color vocabulary.
- **Typography:** keep the current product typography and serif numeric moments where they help scanability.
- **Density:** compact but not cramped. Related items should be grouped tightly, with larger breaks between Today, Progress, and Consistency.
- **Motion:** state-only and brief. Preserve purposeful chart/heatmap reveal, but do not add page-load choreography.
- **Cards:** reserve cards for interactive or self-contained content. Do not wrap every metric in a card.

## 4. Proposed Structure

### 4.1 Today Dock

The top of the dashboard becomes the primary action surface.

Responsibilities:

- Show calories remaining as the first read.
- Show meals already logged today as compact receipts.
- Provide a visible desktop/tablet meal logging action.
- Keep mobile meal logging reachable through the floating button.
- Provide a compact weight logging action, especially when today's weight is missing.

The calories treatment should not be another isolated metric card. It should read more like a status line:

> ~720 kcal left today

Supporting details can sit below or beside it:

- current calories vs target
- macro context when space allows
- short copy that avoids guilt or alarm

Meals already eaten should sit near this line because they explain the number. Empty state copy should teach the next action:

> Log your first meal, then this becomes your running receipt.

Desktop and tablet should include an in-layout meal entry affordance. Mobile keeps the floating meal button as the primary entry point because it matches common app behavior and thumb reach.

Interaction contract:

- Mobile `< 768px`: render the existing floating `MealTrigger` as the primary meal action. Do not render a second primary in-layout meal button.
- Tablet and desktop `>= 768px`: render an in-layout meal action inside Today Dock. Hide the floating trigger or demote it to non-primary if keeping it is necessary for implementation continuity.
- The in-layout action should reuse the existing meal logging route/prefill behavior rather than inventing a second meal submission flow.
- The visible affordance can begin as a button with a short prompt, for example "Log meal", plus the current contextual copy. Inline input expansion is allowed only if it reuses the existing meal trigger behavior and does not create duplicate state.
- Keyboard focus must move predictably to the meal entry control after activation and return to the triggering control on close.

### 4.2 Progress Story

The weight trend section becomes explanation-first, chart-second.

The user should understand the trend without reading the Y-axis or hovering. The section should show:

- One concise verdict line, for example "Down 0.4 kg this week, on pace."
- A start to now comparison, for example "68.2 -> 67.8 kg."
- An expected or projected path detail, for example "Expected 67.6 kg by the end of this range."
- The existing quiet chart as supporting evidence.

The chart should preserve the current warm accent and restrained style. It should avoid noisy legends, stacked badges, and decorative annotations. Hover or tap can expose exact values, but the primary insight must be visible before interaction.

Verdict and summary rules:

- **Insufficient data:** fewer than two weight logs in the selected range. Show the no-data state instead of a verdict.
- **Weekly delta:** use the existing `weeklyRate` or equivalent weight-summary rate when available. If only range points are available, derive an approximate weekly rate from `(currentWeight - periodStartWeight) / elapsedDays * 7`.
- **On pace:** actual weekly rate is within 20% of the expected weekly rate for the user's goal direction.
- **Small-rate fallback:** if the absolute expected weekly rate is below 0.1 kg/week, use an absolute tolerance of 0.1 kg/week instead of the 20% threshold.
- **Expected weekly rate:** calculate as `(expectedEndWeight - periodStartWeight) / rangeDays * 7`.
- **Ahead:** actual weekly rate exceeds the expected rate by more than 20% in the desired direction.
- **Behind:** actual weekly rate is more than 20% slower than expected in the desired direction, or moving opposite the desired direction.
- **Flat goal:** show "Stable this range" when movement stays within a small tolerance, and avoid ahead/behind language.
- **Start value:** first available weight in the selected range, falling back to `periodStartWeight`.
- **Current value:** latest available weight in the selected range.
- **Expected value:** `expectedEndWeight` from the existing summary model.
- **Projection detail:** render only when there are at least three data points. Otherwise show expected value only.

Mobile behavior:

- Summary text and chips sit above the chart.
- Axis labels are reduced or hidden if they compete with the summary.
- The empty state should say that two weigh-ins unlock trend reading and should link users back to weight logging.

### 4.3 Consistency Field

The heatmap becomes the long-memory explanation layer.

Behavior:

- Prefer full current year when width allows.
- Fall back to 90d when year cells would become too small.
- Fall back to 30d on narrow mobile if 90d would become cramped.
- Keep Monday through Sunday rows.
- Columns represent weeks.
- Month headers appear across the top on year and wide 90d views.
- Unlogged cells remain visually distinct and accessible.

The heatmap should visually connect to the weight story. Later, if the data layer supports it, a short insight line can explain patterns such as weekend misses. The redesign should reserve space for this line but not require new analytics in the first implementation.

Year behavior is mandatory for this redesign:

- Add a `year` heatmap range for the current local calendar year, from January 1 through December 31.
- Past dates without meals render as unlogged.
- Future dates render as future/disabled, visually quieter than past unlogged days and not counted in adherence totals.
- Today renders as a normal date cell with the current day's available data.
- Cache keys must include the rendered range, for example `['dashboard', 'heatmapData', 'year']`, so 30d, 90d, and year do not overwrite one another.
- The year view should not require horizontal page scrolling on desktop. If it cannot meet the minimum readable cell size, the rendered range falls back.

## 5. Responsive Layout

### Mobile portrait

Single-column flow:

1. Today Dock
2. Progress Story
3. Consistency Field

Mobile priorities:

- Calories remaining and meal logging appear immediately.
- Meals already eaten are visible as compact stacked rows.
- The floating meal trigger remains primary.
- Weight trend summary appears before the chart.
- Heatmap uses 30d or 90d with touch-friendly cells.

### Tablet and small laptop

Two-zone layout:

- Today Dock spans the top.
- Progress Story and Consistency Field sit side by side when content width supports it.
- If the heatmap cannot stay readable, it drops below Progress Story while keeping the same header rhythm.
- Meals can sit as a right-side panel inside Today Dock or as a second row within the dock.

### Desktop and wide desktop

Use a 12-column page grid:

- Today Dock spans the full width.
- Inside Today Dock, allocate space for calorie status, meal receipts, and logging actions.
- Progress Story receives the wider reading column.
- Consistency Field uses the remaining width and defaults to year if cell size and month labels remain readable.

The shell should stop relying on `grid-rows-[2fr_3fr_2fr]`. The page should be content-led with shared gutters, aligned edges, and intentional section separation.

## 6. Component Boundaries

### `DashboardShell`

Owns:

- page layout
- shared responsive structure
- separate range state for weight and heatmap where needed
- existing high-level data orchestration unless a smaller extraction is clearly safer

Does not own:

- weight trend interpretation details
- meal receipt rendering
- heatmap layout internals

### `TodayDock`

Owns:

- calories remaining status
- today meal receipts
- desktop/tablet meal entry affordance
- compact weight logging affordance
- empty state for no meals today

Inputs:

- `NutritionData`
- `MealEntry[]`
- `WeightSummaryData | undefined`

### `ProgressStory`

Owns:

- weight trend verdict copy
- start/current/expected comparison chips
- projected path detail
- quiet weight chart composition
- no-data state for insufficient weigh-ins

Inputs:

- `weights`
- `periodStartWeight`
- `currentWeight`
- `expectedEndWeight`
- `goalDirection`
- `range`

### `ConsistencyHeatmap`

Owns:

- adaptive heatmap range rendering
- month headers
- day labels
- accessible cell labels and tooltips
- unlogged-cell treatment

Inputs:

- `data: HeatmapCell[][]`, shaped as 7 rows by N week columns.
- `range: '30d' | '90d' | 'year'`.
- `monthHeaders: HeatmapMonthHeader[]`.
- `renderedRangeLabel: string`, for accessible copy and section copy.

Supporting types:

```ts
type HeatmapCellStatus = 'logged' | 'unlogged' | 'future';

interface HeatmapCell {
  date: string;
  ratio: number | null;
  status: HeatmapCellStatus;
}

interface HeatmapMonthHeader {
  month: string;
  startColumn: number;
  span: number;
}
```

Month headers align to week columns. A month header starts at the first week column containing any day in that month and spans through the last week column containing that month.

## 7. Data Flow

Use existing dashboard data sources where possible:

- `useDailyMeals(todayDate)` continues to provide today's persisted meals.
- `buildTodayNutritionData` continues to build today's nutrition summary.
- `useWeightSummary(weightRange)` continues to provide weight summary data.
- `loadCalorieAdherenceHeatmap` continues to provide adherence heatmap data, extended only if year support requires it.

Year support is part of this redesign. Avoid mixing user intent with responsive fallback:

- `weightRange`: controls `ProgressStory` and remains limited to `'30d' | '90d'` because existing weight summary behavior supports those ranges.
- `preferredHeatmapRange`: controls the user's desired heatmap scope and can be `'30d' | '90d' | 'year'`.
- `renderedHeatmapRange`: controls what the current container can display readably and can be `'30d' | '90d' | 'year'`.

This prevents mobile fallback from permanently changing the user's preferred view.

Range controls:

- The visible Progress Story range toggle controls `weightRange` only.
- The heatmap can expose its own compact range control if implementation needs manual override, but its default behavior should be adaptive: prefer `year`, then fall back to `90d`, then `30d`.
- Do not pass `year` into `useWeightSummary`.
- If the UI visually groups Progress Story and Consistency Field under one Progress heading, labels must make clear that weight is using 30d/90d while heatmap may be showing year.

Adaptive range rules:

- Try `year` first when the user has not selected a shorter range.
- Render `year` only when calculated cell size is at least 10px and month headers can fit without overlapping.
- If `year` does not fit, render `90d` when calculated cell size is at least 14px.
- If `90d` does not fit, render `30d`.
- Keep the user's preferred range stable across resizes. Only `renderedHeatmapRange` changes.

Heatmap data loading:

- `loadCalorieAdherenceHeatmap` should accept `range: '30d' | '90d' | 'year'`.
- The `year` range loads all dates in the current local calendar year.
- The response should include enough date information to distinguish logged, unlogged, and future cells.
- The client should not infer future cells only from matrix position when explicit dates are available.

New user-facing copy must be added to both `messages/en.json` and `messages/vi.json` for:

- weight trend verdicts
- insufficient weight data state
- desktop meal action copy
- heatmap range labels
- heatmap future-date cell labels
- Today Dock empty meal state

## 8. Empty and Error States

- If calories or meals fail to load, keep the top action area usable and show existing toast-style error feedback.
- If no meals are logged today, show meal logging guidance near the calories area.
- If fewer than two weight logs exist, replace the chart with a friendly explanation and a weight logging action.
- If heatmap data is unavailable, keep the section height stable and show an accessible no-data state.
- Do not use native browser dialogs.

## 9. Testing Plan

Add or update Vitest coverage for:

- adaptive heatmap range selection: year to 90d to 30d based on available width or cell-size rules
- weight trend summary formatting from start, current, expected, and goal direction
- Today Dock empty state and meal receipt rendering
- Dashboard shell preserving core sections across responsive structures where practical

Existing dashboard page tests should continue to pass. No database migration is expected for this redesign.

## 10. Out of Scope

- Changing nutrition estimation logic
- Changing meal persistence
- Changing weight logging schema
- Adding long-term analytics beyond the reserved heatmap insight line
- Replacing the overall visual identity
- Building a new navigation model

## 11. Implementation Notes

Likely files to modify during implementation:

- `components/dashboard/dashboard-shell.tsx`
- `components/dashboard/current/current-section.tsx`
- `components/dashboard/current/weight-streak-card.tsx`
- `components/dashboard/progress/progress-section.tsx`
- `components/dashboard/progress/weight-chart.tsx`
- `components/dashboard/progress/adherence-heatmap.tsx`
- `components/dashboard/today/today-section.tsx`
- `components/dashboard/today/meal-list.tsx`
- `components/dashboard/today/meal-trigger.tsx`
- `components/dashboard/types.ts`
- related dashboard tests

Implementation should preserve the approved hierarchy and functionality while making the page feel more connected, more readable on mobile, and more useful as an everyday logging surface.
