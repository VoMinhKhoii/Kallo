# Dashboard Redesign — "Show the user whether their plan is working"

**Date**: 2026-04-12  
**Status**: Approved  
**Scope**: Dashboard UX/UI overhaul — layout restructure, chart improvements, bug fixes, shared primitives extraction. `/nutrition` page deferred.

---

## Problem Statement

The current dashboard doesn't clearly answer: **"Is my plan working, and why or why not?"**

Specific issues:
- Redundant space below "Current Pace" card — streak/deficit floated separately
- Adherence heatmap uses circles, card height shifts between 7/30/90 views, tooltip overflow clips
- Weight chart has no visual zone separating on-track vs off-track periods
- `NutritionCheckin` + `MicroSummary` are buried and nearly invisible
- `MealTrigger` is a floating FAB disconnected from the Today context
- Several hand-coded components that should use library primitives (Recharts zones, Radix Tooltip)
- `?meal=` prefill from trigger → logging page is never read (broken flow)

---

## Target Outcomes

| Area | Before | After |
|------|--------|-------|
| Information hierarchy | Flat, no grouping | 3 named sections: Current → Progress → Today |
| Top cards | Wasted space below pace | Pace+Deficit in one card, Weight+Streak in another |
| Weight chart | Single line, no context | Two zones (on/off track) + expected trajectory line |
| Adherence heatmap | Circles, shifting size, broken tooltip | Squares, fixed card height, Radix Tooltip portal, two-sided legend |
| Today section | Isolated, floating FAB | Integrated macro ring+bars (2/3) + meal list (1/3) + inline trigger |
| Macros component | Duplicated from logging | Shared `CalorieRing` + `MacroBars` primitives |
| Meal prefill | Broken (searchParams never read) | Wired via `useSearchParams()` |
| Micros/Macros over time | Buried on dashboard | Deferred to `/nutrition` page (future) |

---

## Wireframe

Approved wireframe at `public/wireframe.html`. Key decisions:

**Section 1 — Current**
- Left card: Your Pace (Lora large num) + status badge + meta | vertical divider | Avg Deficit
- Right card: Morning Weight input (dashed border invite) + last weight | vertical divider | Streak

**Section 2 — Progress** (7/30/90 toggle)
- Weight trend chart: start weight of period = Y-axis midpoint. Above = off-track zone (red tint), below = on-track zone (green tint) for cutting goal. Dashed expected trajectory line. Y-axis anchors: start weight + goal weight.
- Adherence heatmap: squares only, fixed min-height, Radix Tooltip in portal, "Off track" ↔ "On target" two-sided legend

**Section 3 — Today**
- Left 2/3: Calorie ring (SVG) + P/C/F progress bars — same visual as logging page
- Right 1/3: Compact meal list (Meal 1, 2, 3... + user input text + kcal)
- Bottom: "Log meal" button → expands to full-width input with `backdrop-filter: blur(8px)` overlay (mini-modal pattern). Toggles to ✕ close.

---

## File Structure

```
/components/dashboard/
├── dashboard-shell.tsx           (Orchestrator, timeRange state)
├── section-header.tsx            (Reusable: [N] Title · subtitle)
├── current/
│   ├── current-section.tsx       (2-card grid)
│   ├── pace-deficit-card.tsx     (Your Pace | Avg Deficit)
│   └── weight-streak-card.tsx    (Morning Weight | Streak)
├── progress/
│   ├── progress-section.tsx      (Time toggle)
│   ├── weight-chart.tsx          (Recharts + ReferenceArea zones)
│   └── adherence-heatmap.tsx     (Square grid + Radix Tooltip)
├── today/
│   ├── today-section.tsx         (Grid: 2/3 macros + 1/3 meals)
│   ├── meal-list.tsx             (Compact numbered meal list)
│   └── meal-trigger.tsx          (Mini-modal trigger)
├── types.ts
└── mock-data.ts

/components/shared/
├── calorie-ring.tsx              (Shared SVG ring — logging + dashboard)
└── macro-bars.tsx                (Shared P/C/F bars — logging + dashboard)
```

---

## Implementation Tasks

### T1 — shared-primitives
Extract `CalorieRing` (SVG progress ring) and `MacroBars` (P/C/F bars) from `components/logging/feed/macro-summary.tsx` into `/components/shared/`. Update `MacroSummary` to compose from these. Prevents duplication drift.

### T2 — section-header
`SectionHeader` component: numbered badge (dark bg, Lora 13px) + title (Lora 20px bold) + optional right-aligned italic subtitle.

### T3 — section-current *(depends: none)*
- `pace-deficit-card`: Weekly pace (large Lora) + status badge + meta rows (total delta, rolling avg) | divider | Avg deficit value
- `weight-streak-card`: Weight input with dashed border + "Last: X kg · yesterday" | divider | Streak days

### T4 — section-progress *(depends: none)*
- `weight-chart`: Explicit props `{ points, goalDirection, periodStartWeight, goalWeight }`. `ReferenceArea` for above-start (off-track) and below-start (on-track) zones. `ReferenceLine` dashed for expected trajectory. Fix mock data (30d returns 14 points, should return 30).
- `adherence-heatmap`: `aspect-ratio: 1` squares. One `TooltipProvider` wrapping grid, each cell is focusable button with `Tooltip`. Card has `min-height` fixed. Legend "Off track" — gradient — "On target".

### T5 — section-today *(depends: T1)*
- `today-section`: CSS grid `grid-cols-[2fr_1px_1fr]` — macros section | divider | meals section
- Compose `CalorieRing` + `MacroBars` (from shared)
- `meal-list`: `map((meal, i) => Meal {i+1}: {rawInput} ... {kcal})`
- `meal-trigger`: Inside card (not fixed). Open state: renders backdrop div with `backdrop-filter: blur`, pointer-events blocking, full-width input inside card. Escape/outside-click closes. Focus restored on close. `aria-label="Close meal input"` on ✕.

### T6 — wire-shell *(depends: T2, T3, T4, T5)*
Update `dashboard-shell.tsx`: compose `SectionHeader` + all 3 sections. Remove old component imports.

### T7 — wire-meal-prefill *(independent)*
`app/(app)/logging/page.tsx`: read `searchParams.meal`, pass to `LoggingShell`. In `LoggingShell`/input: call `setText(meal)` on mount if present. Clear `?meal=` from URL after prefill.

### T8 — cleanup *(depends: T6)*
Delete: `verdict-hero.tsx`, `stats-card.tsx`, `nutrition-checkin.tsx`, `micro-summary.tsx`. Run `bunx @biomejs/biome check --write .`

### T9 — browser-test *(depends: T6, T7)*
Test at `localhost:3000/dashboard` with credentials. Verify all sections, time toggle, chart zones, heatmap tooltip portals, trigger modal, blur, prefill flow.

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Macro primitives | Extract shared `CalorieRing` + `MacroBars` | Prevents two implementations drifting |
| Chart zones | Recharts `ReferenceArea` | Simpler than custom SVG, rectangular bands fit the use case |
| Heatmap tooltip | Radix `TooltipProvider` + portal | Fixes overflow clipping; one provider wrapping grid |
| Meal trigger | Mini-modal inside card (not floating FAB) | Contextually tied to Today section |
| Client boundary | All dashboard `'use client'` | Mock data + motion animations; RSC split deferred to data wiring phase |
| Responsiveness | Deferred | Focus on desktop correctness first |

---

## Out of Scope (This PR)
- `/nutrition` dedicated page (macros over time, full micronutrient panel, deficiency ingredient lookup)
- Real DB data integration
- Responsiveness / mobile layout
