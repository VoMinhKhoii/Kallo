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
| Greeting | Lora 22 / 400 | `dashHeadline` |

**Why 17/15, superseding the calm 14/12 ramp.** Threads on iOS was measured
directly on 2026-09-01: its feed body is not small. Threads' density comes from
a narrow measure and controlled leading, not tiny type — the calm ramp had
copied the density while shrinking the type, leaving Kallo's body two steps
under every iOS system surface (a Settings row label is 17). Only sizes moved:
colours, spacing tokens, radii, component anatomy and the 12px rhythm are
unchanged. `dashCaption` 13 is an escape hatch for compact components that 15
measurably breaks, never a general tier.

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
