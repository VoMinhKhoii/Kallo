# Mobile design system

The canonical Kallo **mobile** (Flutter) design system — type scale, the two text
colours, and the 12px spacing rhythm — lives in the `kallo-design` skill:

> **`.agents/skills/kallo-design/mobile.md`**

## Type ramp — metric-compensated (2026-09-02)

| Role | Size / weight | Token |
|------|---------------|-------|
| Hero | 40 / 400 | `dashHero` |
| Page title | 28 / 600, −0.6 | `kPageTitle` |
| Section header · Value | 16 / 600 · 16 / 400 | `kSectionHeader` · `dashValue` |
| **Body** | **16 / 400, leading 1.3, −0.2** | `dashBody` |
| **Name** (identity only) | **15 / 600** | `dashName` |
| **Meta** (secondary) | **14 / 400, −0.1** | `dashMeta` |
| Group label | 14 / 400 muted | `kGroupLabel` |
| **Caption** (by exception) | **12 / 400** | `dashCaption` |
| Eyebrow (dial labels only) | 11 / 400 UPPERCASE | `dashEyebrow` |
| Editorial serif | Lora 22 / 400 | `dashHeadline` |
| Wordmark (home masthead) | Lora 28 / 400 ink | `KalloTextStyles.serifRegular` |

**Why 16/14 (2026-09-02), superseding the Threads-scale 17/15.** Threads on
iOS was measured directly on 2026-09-01 — its feed body is not small, and the
calm 14/12 ramp had copied Threads' density while shrinking the type. But the
17/15 that replaced it were **SF Pro** sizes rendered in **Be Vietnam Pro**,
whose cap height is 0.74em to SF's 0.705 and whose advance is ~10% wider; at
the same number BVP is visibly larger and heavier, and the app still read big
at the reference values. 16/14 is the SF relationship translated into this
face (BVP 16 caps 11.8pt ≈ SF 17's 12.0), with a little negative tracking to
pull the wide advance in. The same pass set `ListRow` labels regular, lightened
`kInkMuted` to `#7A7870`, dropped the page title from 700 to 600, and made the
pill nav icon-only. Weight: BVP Medium reads semibold, so every 500 is now
400 and 600 survives only on page title, section header and name. `dashCaption`
12 is an escape hatch for compact components
that 14 measurably breaks, never a general tier.

The **gauge dials are outside this ramp**, on purpose. A figure pinned inside a
30–52pt arc is sized by the arc, not by the reading scale: `dashCaption`'s
"number pinned inside a gauge" exception is spelled out as four styles in
`shared/widgets/gauge/gauge_readout_type.dart` — figure **17/400** (Today),
**14/400** (Log header), unit **14/400**, denominator **12/400**, the same in
both variants. They are **pinned, not aliased**: the reading ramp has moved
underneath them twice (14/12 → 17/15 → 16/14) and the dial stayed at the sizes
the reference screenshot measures.

## Vertical rhythm — the section break (2026-09-01)

The 12px block rhythm is unchanged, with one asymmetry: the gap **above** a
`SectionHeaderRow` is **24** (`DashboardSpacing.sectionBreak`), while the gap
between that header and its own card stays **12** (`DashboardSpacing.block`).

A header equidistant between the card it labels and the card it does not gives
the eye nothing to group it with, and the page reads as one undifferentiated
stack. Doubling only the gap above binds the header to the content below it.
Scaling both would just make the same flat stack taller. Applied on the
Dashboard (`_Section`, and the day → "Recent meals" break) and on Nutrition
(`_group`), which is where the old `majorBreak` (20) lived under another name —
it is gone, absorbed by this token.

## Icon tiers — Threads-derived (2026-09-01)

| Token | Size | Role |
|-------|------|------|
| `KalloIcons.primary` | 24 | navigation / primary utility (pill nav, settings row leading, header) |
| `KalloIcons.action` | 21 | an action ON a card (Log action row, discard, confirm check) |
| `KalloIcons.tertiary` | 18 | tertiary inline affordances (collapse chevron, copy/remove minis, disclosure chevrons — moved from 16; **Circle heart/comment/Eat-this**, moved from `action` 2026-09-07) |

The Circle post row moved down a tier on 2026-09-07. `action` is sized for a
control that carries its card; the heart / comment / Eat-this cluster sits
under a meal name at the very bottom of a post and reads as its footnotes. At
21 it out-weighed the meal it belongs to. All three moved together — two
glyphs at 18 beside a third at 21 reads as a misaligned row, not a quieter one.

`KalloIcons.hit` stays **44** at every tier — only the glyph shrinks, so tap
targets are unchanged. Stroke stays 1.5 (the Lucide `300` constants). Non-action
DATA glyphs (the 14pt macro-legend food icons) are outside the tiers.

## Platform — Cupertino wherever it exists (2026-09-07)

Where Flutter ships a Cupertino widget or behaviour for the thing you are
building, **use it**. Material's ink ripple, spinning arc and bottom-up page
transition are the three things that make an app read as "a Flutter app"; this
one is iOS-first, and none of them is a per-surface taste call.

The rule mostly describes what the app already did — `CupertinoPage` routes,
`CupertinoSliverRefreshControl`, a Cupertino confirm alert, `Switch.adaptive`,
and a long-press menu the app owns outright, `showKalloAnchoredMenu`
(exception recorded 2026-09-08) — but it had never been written down,
so each surface re-decided and 17 Material spinners piled up under a Cupertino
navigation stack.

Three boundaries, spelled out with the full table in `mobile.md`:

- **The app stays on `MaterialApp`.** Every token hangs off `ThemeData`, and
  `TextField`/`InkWell` need a `Material` ancestor. Cupertino is a **widget**
  level choice, not an app-level one.
- **The design system wins on look; the platform wins on behaviour.** Take the
  anatomy, gestures and timing; override SF Pro, system blue and frosted
  surfaces. `kallo_confirm.dart` is the worked example — an iOS alert wearing
  Be Vietnam Pro on a solid card, because "solid surfaces, no stacked
  translucency" outranks `CupertinoPopupSurface`'s default.
- **A widget the app already owns beats both.** `TopToast`, `KalloSheet` and
  `KalloConfirmActions` are not up for replacement by their Cupertino
  equivalents. Reach for Cupertino where the app has no answer of its own.

## Grid cells are not cards (2026-09-07)

The micronutrient grid on Nutrition is the **one bordered surface on the
canvas**, and it is a deliberate exception to the fourth canvas decision
("cards on `kPage` carry no border and no shadow").

A card is a single wide slab: white against `#F8F7F4` at 1.07:1 is a weak edge,
but the slab's own width and the 12px gaps around it do the separating, so the
border adds nothing. A 2-column grid has neither — the cells are small, they
abut each other across a narrow gutter, and at 1.07:1 the run reads as one pale
field rather than as the *individual cells* the surface is asking for. The edge
is doing work here that surface contrast cannot do.

So the grid cells take `kHairline` + `KalloRadii.containerLg` (**16**), not the
card radius (a *met* cell swaps the pair for `successBorder` on
`successFaint` — same edge, coloured by state; see
`nutrition/widgets/nutrients/nutrient_grid_card.dart`). The tighter radius is part of the signal: a 16 corner on a
bordered small cell is visibly not the 22 a card wears, so the exception can
never be mistaken for the rule.

**This is a grid-cell rule, not a card rule.** Cards stay borderless at radius
22 everywhere, including on the same screen. Do not carry the hairline over to
anything that is not a multi-column grid of small cells.

The reference implementation is
`lib/theme/calm_tokens.dart` (`dashHero` / `dashValue`
/ `dashBody` / `dashName` / `dashMeta` / `dashCaption` / `dashHeadline`, the
native-pass header ramp
`kPageTitle` / `kSectionHeader` / `kGroupLabel`, `kInk` / `kInkMuted`, the
`kNav*` pill-nav tokens and the `kNavShowsLabels` switch; `dashEyebrow`
survives only inside components — dial labels). Shared primitives: `shared/widgets/surface/kallo_primitives.dart`
(card, buttons), `shared/widgets/list/` (grouped card + rows),
`shared/widgets/typography/section_header_row.dart`,
`shared/widgets/form/kallo_text_field.dart`,
`shared/widgets/nutrition/meal_block.dart`, `shell/nav/` (pill tab bar).

It's a calmer, Threads / Apple-Health–tuned system, live on every tab and
sheet; auth and onboarding stay light-touch. See `mobile.md` for the full spec
and migration status.
