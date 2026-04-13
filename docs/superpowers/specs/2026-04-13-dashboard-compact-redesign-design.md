# Dashboard Compact Redesign

## Problem

The dashboard has excessive whitespace and vertical stacking, requiring scrolling to see all content. Key numbers (pace, deficit, calories) lack visual prominence. The layout doesn't leverage available horizontal space.

## Goal

Fit all dashboard content into a single viewport without scrolling. Make numeric indicators (pace, deficit, streak, calories remaining) the most eye-catching elements. Achieve a compact, clean, modern look.

## Design

### Layout Strategy

- **Single viewport**: all three sections visible without scrolling
- **Selective cards**: only interactive/self-contained content gets card wrappers (weight logging, meal list). Everything else uses naked layout with dividers.
- **Density**: reduce section gaps from `mb-12` → `mb-4`, card padding `p-5` → `p-3`/`p-4`, remove bottom page padding
- **Number prominence**: key figures get higher contrast (darker color, heavier weight). Lora serif hero numbers remain large. Secondary numbers bump up in size/contrast.

### Section 1: Week Header (was "Current")

**Title**: dynamic — "Week of April 6 – 12, 2026" computed from current ISO week boundaries. Updates automatically each week.

**Layout**: two-column, 50/50 split.

#### Left half: Pace + Deficit

Keep the existing side-by-side layout with vertical divider. No changes to the internal structure — this already works well.

- Current Pace: big Lora serif number + "kg/wk" unit + status pill
- Avg Daily Deficit: big Lora serif number + "kcal/day" unit
- Subtle vertical divider between them

#### Right half: Weight Logging (dominant) + Streak

- **Weight logging** takes ~70% of the right half. Card wrapper since it's interactive (input + save button). Keep the current input design.
- **Streak** takes ~30%, compact display. No card, just the number + "days" label, separated by a vertical divider from weight logging.
- Weight logging is visually dominant: larger area, card border draws attention to the action.

### Section 2: Progress

**Time range toggle**: only two options — 30d and 90d. Remove 7d (redundant with the week header section).

**Container**: fixed height (~260px) to prevent layout shift when switching ranges.

**Layout**: two-column, fluid-width split. The heatmap and weight chart sit side by side. The width ratio adjusts based on time range — heatmap needs more width at 90d. Smooth CSS transition on width changes.

#### Weight Chart (left)

Simplified from current design:

- **Keep**: actual weight line (area chart with gradient fill), start weight reference line
- **Remove**: green "on track" zone, dashed "expected" trend line, "expected" and "on track" legend items
- **Keep**: red "off track" zone only
- **Y-axis domain**: clamped to the goal range (start weight ↔ expected end weight). These two points define the default chart height. If actual data exceeds this range, the axis expands to accommodate.
- **Legend**: only "Off track" indicator remains

#### Adherence Heatmap (right)

Rotated 90° from current layout to a GitHub-contributions-style grid:

- **Y-axis**: 7 rows labeled M, T, W, T, F, S, S (days of week)
- **X-axis**: columns represent weeks (left = oldest, right = most recent)
- **30d view**: ~4 columns
- **90d view**: ~13 columns (one continuous grid, wider)
- Fixed height, dynamic width. Width transitions smoothly between 30d and 90d.
- Keep: adherence rate percentage, color legend bar, tooltips on hover
- Square sizes adjust per range to fit the fixed-height constraint

### Section 3: Today

**Layout**: CalorieRing + MacroBars on the left (no card wrapper), MealList card on the right.

#### CalorieRing (no card)

- Standalone, no card wrapper
- "Remaining" number: increase from 18px to 28px+ for more dominance
- Keep the ring animation and "left" / "/ target" labels
- This is the hero element of the Today section

#### MacroBars (no card)

- Standalone, no card wrapper
- Sits to the right of the CalorieRing
- Keep the existing bar + label + fraction format

#### MealList (in card)

- Stays in its own card with the current design
- Sits on the right side of the Today section

### Data & Types Changes

- `TimeRange` type: remove `'7d'` option, update to `'30d' | '90d'`
- Remove all `7d` branches from mock data functions and chart logic
- Add week boundary computation utility for the section title
- Heatmap data: restructure from `(number | null)[][]` (weeks × 7 days) to match the transposed layout (7 days × N weeks)

### Animation

- Smooth width transition when switching 30d ↔ 90d (CSS `transition` on flex/width)
- Heatmap squares: stagger entrance animation (keep existing `motion` pattern)
- Section entrance animations: keep but with reduced delays for snappier feel

## Files to Modify

| File | Change |
|------|--------|
| `components/dashboard/dashboard-shell.tsx` | Reorder layout, reduce gaps, add week title logic |
| `components/dashboard/section-header.tsx` | Support dynamic titles (week date range) |
| `components/dashboard/types.ts` | Remove `'7d'` from `TimeRange` |
| `components/dashboard/mock-data.ts` | Remove 7d branches, restructure heatmap data |
| `components/dashboard/progress/progress-section.tsx` | Remove 7d toggle, add fluid width split |
| `components/dashboard/progress/adherence-heatmap.tsx` | Rotate grid (7 rows × N cols), dynamic width |
| `components/dashboard/progress/weight-chart.tsx` | Remove on-track/expected, clamp Y-axis to goal |
| `components/dashboard/current/current-section.tsx` | Restructure to 50/50 with weight logging dominant |
| `components/dashboard/current/pace-deficit-card.tsx` | Boost number contrast/weight |
| `components/dashboard/current/weight-streak-card.tsx` | Make weight logging dominant, streak compact |
| `components/dashboard/today/today-section.tsx` | Unwrap card, calorie ring bigger, macros naked |
| `components/shared/calorie-ring.tsx` | Add larger size variant for "remaining" dominance |

## Out of Scope

- Micronutrient display (not currently in the dashboard shell)
- Mobile/responsive breakpoints (desktop-first, can follow up)
- Real data integration (mock data only)
- New features or sections
