# Design follow-ups from the iOS-native pass QA

Deferred visual/UX issues found during the on-device QA sweep of the native
design pass (PR #328/#329). None block the release; each is a small, isolated
change. Verified on iPhone 17 Pro Max simulator, 2026-09-01.

## Items

1. **Full-height error cards** — Today/Log error states render a small centred cluster inside a near-full-height white card, leaving a large empty void; make the state compact on canvas instead.
2. **Two bar languages on Nutrition** — vitamin progress bars are black/green while macro bars are pink/orange/yellow on the same screen; unify the palette.
3. **Calorie delta reads as a percentage** — the hero shows "↑ 99.9" (decimal, no unit); drop the decimal and append the kcal unit.
4. **Welcome screen is bottom-heavy** — roughly 280pt of empty canvas sits above the logo; rebalance the vertical composition.
5. **Settings child pages use a different form idiom** — children render bare fields on canvas while the parent uses grouped white cards; align children to the grouped-card idiom.
6. **Region & language subtitle describes the wrong section** — "Country of origin and current residence" sits under the title but explains the block below the Language section; move or reword it.
7. **Adherence heatmap legend is misleading** *(product decision)* — a 0.85 `PARTIAL_DAY_FRACTION` gate forces every under-target day to `partial` (uncoloured outline), so the legend's under-target terracotta range is unreachable and a warm cell can only ever mean over-eating; either redraw the legend honestly or lower/remove the gate.

## Notes

- Items 1–6 are Flutter-only (`apps/mobile-flutter`). Item 7 is backend domain logic (`lib/domain/dashboard/adherence.ts`, `lib/domain/nutrition/pattern/completeness.ts`) plus the mobile legend.
- Playful empty/error states remain deferred separately (koboyo icons unreachable) — item 1 is the interim fix, not that redesign.
