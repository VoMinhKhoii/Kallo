# Mobile design system

The canonical Kallo **mobile** (Flutter) design system — type scale, the two text
colours, and the 12px spacing rhythm — lives in the `kallo-design` skill:

> **`.agents/skills/kallo-design/mobile.md`**

The reference implementation is
`lib/theme/calm_tokens.dart` (`dashHero` / `dashValue`
/ `dashBody` / `dashMeta` / `dashEyebrow` / `dashHeadline`, `kInk` / `kInkMuted`).

It's a calmer, Threads / Apple-Health–tuned system, currently **live on the
Dashboard**; other screens migrate per-screen. See `mobile.md` for the full spec
and migration status.
