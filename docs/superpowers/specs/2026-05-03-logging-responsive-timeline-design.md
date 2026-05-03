# Logging Responsive Timeline Design

## Status

Approved for spec review.

## Context

The logging page is the user's high-frequency meal capture surface. It already
has a strong visual direction: a warm surface, restrained accent color, Lora for
meal text, compact DM Sans controls, and a meal feed that reads as a vertical
timeline. The weak point is responsiveness. The date timeline sidebar is a
fixed-width desktop navigation rail with no mobile adaptation, while the app
shell already has a mobile bottom tab bar.

This design keeps the current Nham feel and makes the timeline feel deliberate,
not replaced. Register: product UI. The physical scene is a user logging meals
on a phone throughout the day, often one-handed, while needing fast date changes
without losing the meal input or colliding with the bottom navigation.

## Goals

- Make `/logging` responsive across mobile, tablet, and desktop.
- Preserve the existing bottom tab bar on mobile. Timeline UI must not cover it.
- Refine the timeline sidebar so it feels production-ready, not merely present.
- Keep date switching immediate and predictable.
- Preserve the existing meal feed, meal input, and `?meal=` prefill behavior.
- Improve accessibility, focus states, touch targets, and reduced-motion support.

## Non-goals

- Redesign the global app shell or bottom tab bar.
- Replace the logging feed card design.
- Add a modal drawer or bottom sheet for normal date navigation.
- Change meal analysis, persistence, nutrition calculations, or database shape.
- Introduce a calendar library unless later implementation proves the inline
  controls cannot cover the required behavior.

## Responsive behavior

### Mobile

The timeline becomes a compact date rail above the feed. It is page content, not
a fixed drawer and not a bottom sheet. This keeps the global bottom tab bar
visually and interactively separate.

The rail shows:

- Today.
- The selected date.
- Recent logged dates from the existing `loadMealDates` query.
- A small indicator for dates with saved meals.
- A compact month control for older history.

Date selection updates the feed immediately. The rail uses horizontal scrolling
for fast one-handed access. If older history is needed, an inline expanded panel
opens below the rail and pushes the feed down. It is not modal, does not trap
focus, and never overlays the bottom tab bar.

### Tablet and desktop

The existing sidebar remains the primary date navigation. It becomes a refined
timeline panel with:

- Clearer month and week hierarchy.
- Stronger selected-date treatment.
- Better spacing rhythm between month groups.
- Visible keyboard focus.
- Empty/loading handling.
- Motion that communicates expand/collapse without slowing the task.

The breakpoint should follow the app shell: mobile rail below `md`, desktop
sidebar at `md` and above.

## Component design

### `LoggingShell`

`LoggingShell` becomes the responsive orchestrator.

Responsibilities:

- Own `selectedDate`.
- Initialize from today, or from a validated `?date=YYYY-MM-DD` if implemented.
- Preserve and pass through `initialMeal` for the existing dashboard-to-logging
  prefill flow.
- Render `MobileTimelineRail` for mobile and `TimelineSidebar` for `md` and up.
- Pass `selectedDate` to `FeedArea`.
- Continue calling `usePrefetchDates(selectedDate)`.

### Timeline utilities

Move pure date helpers out of `timeline-sidebar.tsx` so desktop and mobile can
share them without duplicating logic.

Suggested module:

```text
components/logging/sidebar/timeline-utils.ts
```

Utilities:

- `todayDateString()`.
- `formatDayLabel(date, locale)`.
- `formatCompactDayLabel(date, locale)`.
- `weekOfMonth(date)`.
- `groupByMonth(dates)`.
- `getSelectedMonthKey(date)`.
- `getSelectedWeekKey(date)`.
- `buildMobileRailDates(allDates, selectedDate, today)`.

Keep these functions pure and unit-tested.

### `TimelineSidebar`

Desktop-only timeline panel.

Design updates:

- Use the same data contract: `userId`, `selectedDate`, `onSelectDate`.
- Keep TanStack Query for `meal-dates`.
- Use a rounded panel surface or clearly bounded rail so it feels intentional
  beside the feed.
- Make month labels scannable and quieter than selectable dates.
- Make selected week/date treatment stronger than hover.
- Keep expand/collapse controls as buttons with `aria-expanded` and
  `aria-controls`.
- Add `focus-visible` rings to all interactive elements.
- Avoid hover-only meaning.

### `MobileTimelineRail`

Mobile-only date control.

Responsibilities:

- Read the same meal-date query result, or receive normalized dates from
  `LoggingShell` if implementation chooses to lift the query.
- Render horizontal date chips with at least 44px touch height.
- Keep Today and the selected date reachable even when they are not adjacent in
  the returned meal-date list.
- Show a meal indicator for dates that exist in `loadMealDates`.
- Use `aria-current="date"` for the selected chip.
- Provide a compact month/history control for older dates.
- Avoid fixed positioning so the bottom tab bar owns the bottom of the screen.

### `MobileTimelineExpandedPanel`

Optional inline expansion for older history.

Responsibilities:

- Render month/week/date groups in compact form.
- Open below the rail and push content down.
- Use semantic `nav`, `ul`, `li`, and `button` elements.
- Close after a date is selected.
- Not trap focus, because it is not modal.
- Use `overscroll-behavior: contain` only if the panel itself scrolls.

### `TimelineDateButton`

Small shared primitive for date actions.

States:

- Default.
- Hover for pointer devices.
- Active/pressed.
- Selected.
- Today.
- Focus-visible.
- Disabled if needed for future unavailable dates.

This avoids separate visual languages between desktop and mobile.

## Data flow

The existing server action remains the source for saved meal dates:

```ts
loadMealDates({ timezoneOffset }): Promise<string[]>
```

The query key remains scoped by user and timezone offset. Stale time can stay at
60 seconds unless implementation finds a reason to extract a shared query key.

`selectedDate` drives:

- The active date in the timeline controls.
- `FeedArea` persisted meal loading through the existing `useDailyMeals`.
- Adjacent-day prefetching through `usePrefetchDates`.

Production-ready URL behavior:

- Extend the logging page search params schema with optional `date`.
- Initialize `LoggingShell` from that date when valid.
- On date selection, `router.replace` can update `?date=` without scrolling.
- Preserve `?meal=` behavior for prefilled meal input.

If URL synchronization proves too risky during implementation, it can be
deferred, but the design preference is that selected date survives refresh and
back/share behavior.

## Visual direction

Color strategy: restrained. Accent color is reserved for the selected date,
meal-day indicators, and active timeline structure.

Desktop sidebar:

- Warmer bounded surface against `bg-nham-surface`.
- Selected date uses a confident filled/tinted pill.
- Month labels are small, uppercase or near-uppercase, and subdued.
- Week rows are medium-weight controls with clear expanded state.
- Separators are quiet and rhythmic, not repetitive card dividers.

Mobile rail:

- Selected chip is visually strongest.
- Today is distinct but quieter than selected.
- Logged dates get a tiny dot or ring indicator.
- Long localized labels truncate safely.
- Chips have intentional pressed feedback.

Avoid:

- A mobile drawer that covers or competes with the bottom tab bar.
- Nested cards around the timeline.
- Decorative glass or heavy gradients.
- `transition-all`.
- Hover-only affordances.

## Motion

Motion should communicate state only.

- Date chip feedback: 100-150ms color/transform.
- Month/week reveal: 180-220ms opacity plus transform or grid-row reveal.
- No bounce or elastic easing.
- Prefer explicit transitions such as `transition-colors`,
  `transition-transform`, or `transition-opacity`.
- Respect `prefers-reduced-motion`.

Do not animate expensive layout properties for decorative effect. If a small
inline reveal needs height-like behavior, use a grid-row reveal pattern or a
simple conditional render with opacity.

## Accessibility and interaction requirements

- Date actions are `<button>` elements.
- Navigation destinations remain `<Link>` elements.
- Active date uses `aria-current="date"`.
- Expand/collapse buttons use `aria-expanded` and `aria-controls`.
- Icon-only controls have `aria-label`.
- Decorative icons use `aria-hidden="true"`.
- Focus states use visible `focus-visible` rings.
- Touch targets are at least 44px tall on mobile.
- Mobile controls use `touch-action: manipulation`.
- The inline expanded panel does not trap focus.
- Dates use `Intl.DateTimeFormat` via locale-aware helpers.
- Empty states should explain that no meals have been logged yet and still keep
  Today selectable.

## Testing and verification

Unit tests:

- Date grouping by month and week.
- Today insertion.
- Mobile rail date selection around selected/today/recent logged dates.
- Optional `date` search param validation if URL sync is implemented.

Component tests:

- Mobile rail renders selected date with `aria-current="date"`.
- Selecting a mobile rail date calls `onSelectDate`.
- Older-history panel opens and closes.
- Desktop sidebar month/week buttons expose `aria-expanded`.
- Focusable date controls have accessible names.

Manual/browser verification:

- Mobile width: rail appears above feed; bottom tab bar remains visible and
  usable.
- Tablet/desktop widths: sidebar appears, mobile rail is absent.
- No horizontal overflow on narrow screens.
- Meal input remains reachable above the bottom tab bar.
- Reduced motion setting does not leave hidden content inaccessible.
- Keyboard navigation reaches timeline controls and feed input in a sensible
  order.

## Implementation sequence

1. Extract pure timeline utilities and test them.
2. Refactor `TimelineSidebar` to use the shared utilities without changing
   behavior.
3. Add `MobileTimelineRail` and the shared date button primitive.
4. Add optional inline expanded mobile history panel.
5. Wire responsive rendering in `LoggingShell`.
6. Add optional `?date=` parsing and URL synchronization.
7. Polish desktop sidebar states, focus rings, and motion.
8. Add component tests and run the existing validation commands.

