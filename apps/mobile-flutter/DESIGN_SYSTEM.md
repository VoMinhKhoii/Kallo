# Mobile design system

The canonical Kallo **mobile** (Flutter) design system — type scale, the two text
colours, and the 12px spacing rhythm — lives in the `kallo-design` skill:

> **`.agents/skills/kallo-design/mobile.md`**

The reference implementation is
`lib/theme/calm_tokens.dart` (`dashHero` / `dashValue`
/ `dashBody` / `dashMeta` / `dashHeadline`, the native-pass header ramp
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
