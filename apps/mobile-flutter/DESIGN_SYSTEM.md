# Nhẩm mobile — typography, colour & spacing

The calm, Threads / Apple-Health–tuned system (2026-07). The throughline:
**hierarchy comes from weight + colour, not size**; a compact, uniform vertical
rhythm; and exactly one editorial serif moment per viewport.

This is the **canonical mobile design system**. It is **live on the Dashboard**.
Other surfaces (Nutrition, Logging, Onboarding, Settings) are **not yet
migrated** — do new work against these tokens and migrate existing screens
per-screen with QA (see _Status_ below).

## Type scale — Be Vietnam Pro (sans), Lora (serif, once)

| Role | Size | Weight | Tracking | Used for |
|------|------|--------|----------|----------|
| Hero | 40 | 500 (medium) | −1.0 | the ONE big number per card (calories remaining, weight) |
| Value | 17 | 500 | — | ring-centre number, metric values |
| Body | 14 | 400 | — | meal names, primary detail, the `/target` denominator |
| Meta | 12 | 400 | — | captions, units, stat values, dates |
| Eyebrow | 11 | 500 | +0.3, UPPERCASE | section labels (muted) |
| Greeting | 22 | 400 | −0.3 | Lora serif — the single editorial moment per viewport |

- **Weights**: medium (500) is the ceiling for data; body/meta stay regular
  (400). Be Vietnam Pro reads heavy, so semibold felt thick — medium keeps big
  numbers prominent without weight. Serif is **never** bold.
- **Font**: Be Vietnam Pro (bundled, full Vietnamese diacritics) is the sans.
  Threads' own font (Circular) is proprietary and lacks Vietnamese, so it is not
  an option — the "Threads feel" is delivered by size/weight/spacing, not the
  typeface.

## Colour — exactly two text colours

| Token | Hex | Role |
|-------|-----|------|
| `kInk` | `#2C2416` | primary data — numbers, meal names, macro labels |
| `kInkMuted` | `#8C867C` | everything secondary — labels, units, captions, dates |

No third "disabled" tier. (`kInkSecondary` / `kInkDisabled` still exist for the
un-migrated Nutrition screens — **do not add new usages**.)

## Spacing — one 12px rhythm

`12px` (`NhamSpacing.sp3`) between **all** major stacked components:
greeting ↔ week strip ↔ card title ↔ card ↔ card. Card padding is `16`
(`sp4`), card radius `22`. Within-card gaps (e.g. meal rows) are tighter and
deliberate; the 12px rule governs the *between-component* rhythm.

## Reference implementation

`lib/features/dashboard/widgets/dashboard_tokens.dart` —
`dashHero` / `dashValue` / `dashBody` / `dashMeta` / `dashEyebrow` /
`dashHeadline`, plus `kInk` / `kInkMuted`. Inter-component spacing lives in
`dashboard_screen.dart` (the `sp3` rhythm) and the section widgets.

## Status / migration

- ✅ **Dashboard** — live on this system.
- ⛔ **Nutrition** — still on legacy `kInkSecondary` (taupe) / `kInkDisabled`
  (stone) and the old type scale. Migrate to `kInkMuted` + the scale above.
- ⛔ **Logging, Onboarding, Settings** — not yet reviewed.

When a screen is migrated and no screen references `kInkSecondary` /
`kInkDisabled`, delete those constants.
