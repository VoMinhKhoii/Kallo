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

| Role | Size | Weight | Leading | Tracking | Used for |
|------|------|--------|---------|----------|----------|
| Hero | 40 | 500 (medium) | 1.05 | −1.0 | the ONE big number per card (calories remaining, weight) |
| Value | 17 | 500 | 1.1 | — | ring-centre number, metric values |
| Body | 14 | 400 | 1.3 | — | meal names, primary detail, the `/target` denominator |
| Meta | 12 | 400 | 1.25 | — | captions, units, stat values, dates |
| Eyebrow | 11 | 500 | 1.3 | +0.3, UPPERCASE | section labels (muted) |
| Greeting | 22 | 400 | — | −0.3 | Lora serif — the single editorial moment per viewport |

Medium (500) is the **weight ceiling for data** — Be Vietnam Pro reads heavy, so
semibold felt thick; body/meta stay regular (400). Serif is never bold.

**Leading is tight on purpose.** Body sits at 1.3 and meta at 1.25, not the
1.45/1.35 they started at. These are scannable data rows, not prose — the loose
leading made cards read padded even once their gaps were tightened, and it is
the first lever to reach for when a screen "feels big" (before touching sizes,
which are already below iOS's 17pt default body).

### One scale per surface

A screen picks **at most three sizes**. The logging feed is the reference
implementation: Value 17 for the one figure per card, Body 14 for content, Meta
12 for everything quiet — with the serif quote at 17 as the single editorial
moment. Anything outside those three needs a comment saying why.

Do NOT mix `NhamTextVariant` with `dash*` on the same screen. `NhamText` does
`base.merge(style)`, so a `dash*` override silently beats the variant's size and
weight — which is how one card ended up rendering collapsed kcal at 17/500 and
its total kcal three lines below at 16/700. On calm surfaces, use plain `Text`
with a `dash*` token.

### Text scaling

Dynamic Type is respected but **capped at 1.3x** (`MediaQuery.withClampedTextScaling`
in `app.dart`). Past that the feed's fixed-width columns — macro labels, gram
readouts, stepper values — overflow their rows. There is deliberately **no lower
bound**: users who prefer smaller text get it, and nothing breaks below 1.0.

When judging whether a screen "feels too big", check the device's Text Size
setting first — at 130% every number below is 30% larger than spec.

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
card radius `22`. Card padding is **16 horizontal / 12 vertical** where the card
opens or closes on text (`LoggingSpacing.card`): the first and last lines each
carry ~4px of line-height slack above and below their glyphs, so a flat 16 reads
top-heavy. Equal *optically*, not geometrically — that is the one that matters.

The composer goes further (`LoggingSpacing.composer`, 10 sides / 6 top / 4
bottom — only the edge above running text keeps its room): it stacks two more
insets of its own — the field's min-height centring its single line, and the send
button's 44pt tap target wrapping a 32pt visual. Count every inset in the stack
before setting the outermost one; a control-dense card needs less than a
text-only one to land in the same place. Within-card gaps (e.g. meal rows) are tighter and deliberate;
the 12px rule governs the *between-component* rhythm.

This is the default for **presentational** surfaces — the dashboard, settings,
onboarding. A dense scrolling **list** surface may run tighter; the logging feed
does, at 8px, and names it (see *Spacing — one rhythm per surface* below). Going
tighter than 12 is a per-surface decision that must be captured in a named token
set, never improvised gap by gap.

## Spacing — one rhythm per surface

Gaps resolve to a small named set, not per-widget guesses. The logging feed's
`LoggingSpacing` is the pattern to copy.

**It deliberately overrides the 12px default above**: `block` is 8, not 12,
including for card ↔ card. The logging feed is a dense scrolling list where the
default rhythm left the day feeling padded — and every card there also carries a
time divider and an action row, which already separate them. Presentational
surfaces stay at 12; this is the documented exception, not a new default.

| Token | Value | Used for |
|-------|-------|----------|
| `block` | 8 | between the big blocks — header ↔ list ↔ composer, and card ↔ card |
| `section` | 12 | inside a card: above/below every hairline, between sections |
| `row` | 4 | vertical padding on one item row (so neighbours sit `block` apart) |
| `actions` | 2 | a card ↔ the action icons under it (they carry their own inset) |

**A card never carries a bottom margin.** The parent stack owns the gap — a list
separator or a `Column`'s `spacing`. Margins on both sides silently double, which
is how cards ended up 20px apart when the separator said 8.

### Icons

One glyph size and one hit target per surface. Logging uses `LoggingIcons.size`
16 on `LoggingIcons.hit` 36 for every icon-only control — chevrons, steppers,
row-removes, composer controls, send/stop. The pressed wash hugs the glyph rather
than filling the hit box: the target can grow for accessibility without the press
affordance growing with it.

The one documented exception on the logging page is the calorie ring's
`LEFT`/`OVER` label at 8px — it sits inside a fixed 78px ring that 12px overflows.

### Status colour

Errors stay red on the **affordance**, not the copy: the alert icon and the
terracotta action button carry the signal while the message itself reads in
`kInkMuted`. A whole card of red text reads as an alarm for something the user
can usually just retry.

## Reference implementation (source of truth)

`apps/mobile-flutter/lib/theme/calm_tokens.dart` —
`dashHero` / `dashValue` / `dashBody` / `dashMeta` / `dashEyebrow` /
`dashHeadline`, plus `kInk` / `kInkMuted`. Inter-component spacing lives in
`dashboard_screen.dart` (the `sp3` rhythm) and the section widgets.

## Status / migration

**Palette + token adoption** — settled, unchanged by the density work:

- ✅ **Dashboard, Nutrition, Logging, Onboarding, Settings** — on `kInk` +
  `kInkMuted` and the calm `dash*` scale.
- 🔸 **Auth** — a deliberate **light-touch**: body / labels / buttons are on the
  calm sans tokens and the two-colour palette, but its serif brand identity is
  preserved intact (the "Nhẩm" wordmark, the italic tagline, and the form titles
  stay serif — that is the one surface where serif is the point, not an accent).

Two shared-widget paths still carry pre-calm styling where a call site didn't
override them: `lib/shared/widgets/nham_text.dart` (its `NhamTextVariant`
defaults) and the logging `mealQuote` serif variant. These are intentional and
out of the calm token set; migrate the shared widget separately if desired.

### ⚠️ The density rules below are PROVISIONAL

The *at-most-three-sizes* rule, the `LoggingSpacing` rhythm, `LoggingIcons`,
never-margin-a-card, and status-colour-on-the-affordance are implemented on
**logging only** and have **not yet been validated on a physical device**.

Two of the changes are already **app-wide** and reach surfaces that were never
designed around them — check these first when validating:

| Change | Scope | Risk |
|--------|-------|------|
| `dashBody` leading 1.45 → 1.3, `dashMeta` 1.35 → 1.25 | every surface | dashboard / settings / circle / onboarding / auth / nutrition now read tighter than when they were designed |
| Text scaling capped at 1.3x | every surface | a user above 130% sees text stop growing |

Do **not** port the density rules to another surface until logging is signed off
on hardware. If it is rejected, the leading is the first thing to revert — it is
two numbers in `calm_tokens.dart` and it moves every screen at once.

### Porting a surface (once logging is signed off)

1. Inventory it: `grep -rhoE "NhamTextVariant\.[a-zA-Z]+|dash[A-Z][a-zA-Z]*\(" <dir> | sort | uniq -c`.
2. Map every hit onto Value 17 / Body 14 / Meta 12. More than three sizes on one
   screen means the mapping is wrong, not that the screen is special.
3. Replace `NhamText(variant:)` with plain `Text(style: dash*())`. Watch the
   merge trap: a call site passing **both** keeps the override and silently
   drops the variant's size.
4. Name the surface's gaps in one constants file, the way
   `logging/logic/logging_spacing.dart` does. Presentational surfaces keep the
   12px default; only a dense scrolling list earns tighter.
5. Strip card-owned bottom margins — the parent stack owns every gap.
6. One glyph size + one hit target for icon-only controls.
7. Re-check on device at 100% **and** at the smallest Dynamic Type step.
