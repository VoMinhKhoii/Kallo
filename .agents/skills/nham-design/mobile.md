# Nhẩm mobile (Flutter) — type, colour & spacing

The **mobile** design system for `apps/mobile-flutter`. It shares the brand core
with web (neutral canvas + warm accent palette, logo, Vietnamese-diacritic rule,
no-emoji, Lucide) but is
a **calmer, Threads / Apple-Health–tuned** system that deliberately **diverges**
from the web type scale and tokens. Do not apply `--nham-*` CSS tokens, DM Sans,
or the web scale here.

Throughline: **hierarchy comes from weight + colour, not size**; a compact,
uniform vertical rhythm; exactly one editorial serif moment per viewport.

**Live across the app.** Dashboard, Nutrition, Logging, Onboarding, and Settings
all run on this system; Auth is a deliberate **light-touch** (see _Status_). Do
all new mobile UI work against this doc.

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

## Colour — neutral canvas, exactly two text colours

The palette is a **neutral canvas / ink / hairline** system (the old cream /
espresso / biscotti trio is retired). Interaction washes stay **warm**, and the
tan accent survives only on **non-text** moments — ring/chart strokes, the streak
Flame, focus/press rings, and the one deliberate italic-accent phrase. Tan never
colours running text or ordinary icons; former gold text/marks become ink or
muted. Tan selection washes become the warm hover wash + ink + semibold, and
surface-tinted cards that would read grey on the canvas become solid white.

| Token | Hex | Role |
|-------|-----|------|
| `kPage` | `#F9F9F7` | app canvas — neutral gray-white |
| `kCardSurface` | `#FFFFFF` | cards / sheets — solid white |
| `kTrack` | `#F5F4F0` | ring/bar tracks (warm), the only low-contrast surface |
| `kHairline` | `#E8E6DC` | the one border — neutral hairline |
| `kInk` | `#141413` | primary data — numbers, meal names, macro labels |
| `kInkMuted` | `#6E6D66` | everything secondary — labels, units, captions, dates |

`NhamColors` mirrors these plus `textSoft #3D3D3A` (long body), `hover #F0EAE0`
(warm select wash), and the unchanged accent `#C9A87C`, button umber `#695E4E`,
`danger #D37B69`, `success`, and macro colours.

No third "disabled" tier. The old `kInkSecondary` (taupe) / `kInkDisabled`
(stone) constants have been **deleted** — every surface is on `kInk` + `kInkMuted`.

## Spacing — one 12px rhythm

`12px` (`NhamSpacing.sp3`) between **all** major stacked components:
greeting ↔ week strip ↔ card title ↔ card ↔ card. Card padding `16` (`sp4`),
card radius `22`. Within-card gaps (e.g. meal rows) are tighter and deliberate;
the 12px rule governs the *between-component* rhythm.

## Reference implementation (source of truth)

`apps/mobile-flutter/lib/theme/calm_tokens.dart` —
`dashHero` / `dashValue` / `dashBody` / `dashMeta` / `dashEyebrow` /
`dashHeadline`, plus `kInk` / `kInkMuted`. Inter-component spacing lives in
`dashboard_screen.dart` (the `sp3` rhythm) and the section widgets.

## Status / migration

- ✅ **Dashboard, Nutrition, Logging, Onboarding, Settings** — live on this system
  (`kInk` + `kInkMuted`, the calm scale).
- 🔸 **Auth** — a deliberate **light-touch**: body / labels / buttons are on the
  calm sans tokens and the two-colour palette, but its serif brand identity is
  preserved intact (the "Nhẩm" wordmark, the italic tagline, and the form titles
  stay serif — that is the one surface where serif is the point, not an accent).

Two shared-widget paths still carry pre-calm styling where a call site didn't
override them: `lib/shared/widgets/nham_text.dart` (its `NhamTextVariant`
defaults) and the logging `mealQuote` serif variant. These are intentional and
out of the calm token set; migrate the shared widget separately if desired.
