# Nhẩm mobile (Flutter) — type, colour & spacing

The **mobile** design system for `apps/mobile-flutter`. It shares the brand core
with web (warm palette, logo, Vietnamese-diacritic rule, no-emoji, Lucide) but is
a **calmer, Threads / Apple-Health–tuned** system that deliberately **diverges**
from the web type scale and tokens. Do not apply `--nham-*` CSS tokens, DM Sans,
or the web scale here.

Throughline: **hierarchy comes from weight + colour, not size**; a compact,
uniform vertical rhythm; exactly one editorial serif moment per viewport.

**Live on the Dashboard.** Nutrition / Logging / Onboarding / Settings are **not
yet migrated** — do new work against this doc; migrate existing screens
per-screen with QA (see _Status_).

## Font

- **Be Vietnam Pro** is the sans — bundled, full **Vietnamese diacritics**.
  (Threads' own font, Circular, is proprietary and lacks Vietnamese, so it's not
  an option; the "Threads feel" comes from size/weight/spacing, not the typeface.)
- **Lora** serif — the greeting only, never bold.

## Type scale

| Role | Size | Weight | Tracking | Used for |
|------|------|--------|----------|----------|
| Hero | 40 | 500 (medium) | −1.0 | the ONE big number per card (calories remaining, weight) |
| Value | 17 | 500 | — | ring-centre number, metric values |
| Body | 14 | 400 | — | meal names, primary detail, the `/target` denominator |
| Meta | 12 | 400 | — | captions, units, stat values, dates |
| Eyebrow | 11 | 500 | +0.3, UPPERCASE | section labels (muted) |
| Greeting | 22 | 400 | −0.3 | Lora serif — the single editorial moment per viewport |

Medium (500) is the **weight ceiling for data** — Be Vietnam Pro reads heavy, so
semibold felt thick; body/meta stay regular (400). Serif is never bold.

## Colour — exactly two text colours

| Token | Hex | Role |
|-------|-----|------|
| `kInk` | `#2C2416` | primary data — numbers, meal names, macro labels |
| `kInkMuted` | `#8C867C` | everything secondary — labels, units, captions, dates |

No third "disabled" tier. (`kInkSecondary` / `kInkDisabled` still exist for the
un-migrated Nutrition screens — do **not** add new usages.)

## Spacing — one 12px rhythm

`12px` (`NhamSpacing.sp3`) between **all** major stacked components:
greeting ↔ week strip ↔ card title ↔ card ↔ card. Card padding `16` (`sp4`),
card radius `22`. Within-card gaps (e.g. meal rows) are tighter and deliberate;
the 12px rule governs the *between-component* rhythm.

## Reference implementation (source of truth)

`apps/mobile-flutter/lib/features/dashboard/widgets/dashboard_tokens.dart` —
`dashHero` / `dashValue` / `dashBody` / `dashMeta` / `dashEyebrow` /
`dashHeadline`, plus `kInk` / `kInkMuted`. Inter-component spacing lives in
`dashboard_screen.dart` (the `sp3` rhythm) and the section widgets.

## Status / migration

- ✅ **Dashboard** — live on this system.
- ⛔ **Nutrition** — still on legacy `kInkSecondary` (taupe) / `kInkDisabled`
  (stone) and the old scale. Migrate to `kInkMuted` + the scale above.
- ⛔ **Logging, Onboarding, Settings** — not yet reviewed.

When every screen is migrated and nothing references `kInkSecondary` /
`kInkDisabled`, delete those constants.
