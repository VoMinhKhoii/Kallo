# Mobile design system

The canonical Kallo **mobile** (Flutter) design system — type scale, the two text
colours, and the 12px spacing rhythm — lives in the `kallo-design` skill:

> **`.agents/skills/kallo-design/mobile.md`**

## Type ramp — Threads scale (2026-09-01)

| Role | Size / weight | Token |
|------|---------------|-------|
| Hero | 40 / 500 | `dashHero` |
| Page title | 28 / 700 | `kPageTitle` |
| Section header · Value | 17 / 600 · 17 / 500 | `kSectionHeader` · `dashValue` |
| **Body** | **17 / 400·500, leading 1.35** | `dashBody` |
| **Name** (identity only) | **16 / 600** | `dashName` |
| **Meta** (secondary) | **15 / 400** | `dashMeta` |
| Group label | 15 / 500 muted | `kGroupLabel` |
| **Caption** (by exception) | **13 / 400·500** | `dashCaption` |
| Eyebrow (dial labels only) | 11 / 500 UPPERCASE | `dashEyebrow` |
| Editorial serif | Lora 22 / 400 | `dashHeadline` |
| Wordmark (home masthead) | Lora 28 / 400 ink | `KalloTextStyles.serifRegular` |

**Why 17/15, superseding the calm 14/12 ramp.** Threads on iOS was measured
directly on 2026-09-01: its feed body is not small. Threads' density comes from
a narrow measure and controlled leading, not tiny type — the calm ramp had
copied the density while shrinking the type, leaving Kallo's body two steps
under every iOS system surface (a Settings row label is 17). Only sizes moved:
colours, spacing tokens, radii, component anatomy and the 12px rhythm are
unchanged. `dashCaption` 13 is an escape hatch for compact components that 15
measurably breaks, never a general tier.

The **gauge dials are outside this ramp**, on purpose. A figure pinned inside a
30–52pt arc is sized by the arc, not by the reading scale: `dashCaption`'s
"number pinned inside a gauge" exception is spelled out as four styles in
`shared/widgets/gauge/gauge_readout_type.dart` — figure **17/500** (Today),
**14/500** (Log header), unit **14/400**, denominator **12/400**, the same in
both variants. These are the pre-ramp sizes, restored 2026-09-01 after the ramp
lifted them into the arc's mouth.

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
| `KalloIcons.action` | 21 | an action ON a card (Log action row, Circle heart/comment/Eat-this, discard, confirm check) |
| `KalloIcons.tertiary` | 18 | tertiary inline affordances (collapse chevron, copy/remove minis, disclosure chevrons — moved from 16) |

`KalloIcons.hit` stays **44** at every tier — only the glyph shrinks, so tap
targets are unchanged. Stroke stays 1.5 (the Lucide `300` constants). Non-action
DATA glyphs (the 14pt macro-legend food icons) are outside the tiers.

The reference implementation is
`lib/theme/calm_tokens.dart` (`dashHero` / `dashValue`
/ `dashBody` / `dashName` / `dashMeta` / `dashCaption` / `dashHeadline`, the
native-pass header ramp
`kPageTitle` / `kSectionHeader` / `kGroupLabel`, `kInk` / `kInkMuted`, and the
`kNav*` pill-nav tokens; `dashEyebrow` survives only inside components — dial
labels). Shared primitives: `shared/widgets/surface/kallo_primitives.dart`
(card, buttons), `shared/widgets/list/` (grouped card + rows),
`shared/widgets/typography/section_header_row.dart`,
`shared/widgets/form/kallo_text_field.dart`,
`shared/widgets/nutrition/meal_block.dart`, `shell/nav/` (pill tab bar).

It's a calmer, Threads / Apple-Health–tuned system, currently **live on the
Dashboard**; other screens migrate per-screen. See `mobile.md` for the full spec
and migration status.
