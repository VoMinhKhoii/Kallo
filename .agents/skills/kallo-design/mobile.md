# Kallo mobile (Flutter) — type, colour & spacing

The **mobile** design system for `apps/mobile-flutter`. It shares the brand core
with web (neutral canvas + warm accent palette, logo, Vietnamese-diacritic rule,
no-emoji, Lucide) but is
a **calmer, Threads / Apple-Health–tuned** system that deliberately **diverges**
from the web type scale and tokens. Do not apply `--kallo-*` CSS tokens, DM Sans,
or the web scale here.

Throughline: **hierarchy comes from weight + colour, not size**; a compact,
uniform vertical rhythm; exactly one editorial serif moment per viewport.

**Live across the app** and validated on device. Logging, Dashboard, Settings,
Feedback and the shell run the full system — three sizes, two colours, one
named spacing rhythm per surface; Circle and Nutrition are partly ported and
Auth is a deliberate **light-touch** (see _Status_). Do all new mobile UI work
against this doc, and read _Traps_ before porting a surface — every entry there
shipped a visible bug first.

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

Do NOT mix `KalloTextVariant` with `dash*` on the same screen. `KalloText` does
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
espresso / biscotti trio is retired). Interaction washes stay **warm** (with one
carve-out for the press wash, below), and the
tan accent survives only on **non-text** moments — ring/chart strokes, the streak
Flame, focus/press rings, and the one deliberate italic-accent phrase. Tan never
colours running text or ordinary icons; former gold text/marks become ink or
muted. Tan selection washes become the warm hover wash + ink + semibold, and
surface-tinted cards that would read grey on the canvas become solid white.

| Token | Hex | Role |
|-------|-----|------|
| `kPage` | `#F1F1EE` | app canvas — neutral gray |
| `kCardSurface` | `#FFFFFF` | cards / sheets — solid white |
| `kTrack` | `#EDECE7` | ring/bar tracks (warm), the only low-contrast surface |
| `kHairline` | `#E2DFD4` | the one border — neutral hairline |
| `kInk` | `#141413` | primary data — numbers, meal names, macro labels |
| `kInkMuted` | `#6E6D66` | everything secondary — labels, units, captions, dates |

`KalloColors` mirrors these plus `textSoft #3D3D3A` (long body), `hover #F0EAE0`
(warm select wash), and the unchanged accent `#C9A87C`, button umber `#695E4E`,
`success`, and macro colours.

**Red means "this destroys something", not "your numbers are off."** Those were
one terracotta token and are now two:

| Token | Hex | Role |
|-------|-----|------|
| `danger` | `#D11A1A` | destructive actions (delete, remove, sign out) and error text — a plain red |
| `offTarget` | `#D37B69` | over/under target: the ring's overflow arc, an exceeded target bar, a nutrient past its limit |

The old shared `#D37B69` was a warm desaturated accent that read as decorative
rather than destructive, and at 2.7:1 on the canvas it was the weakest text
colour in the app. Splitting the token is what lets destructive UI go properly
red without the dashboard turning alarming the moment you go 10 kcal over — the
ring's own rule is still "never red, never a pill".

`danger` is a **text** colour (row labels, error copy, the danger button), so it
clears WCAG AA for normal text at **4.8:1** on the canvas. The obvious reds do
not: iOS system red `#FF3B30` is 3.1:1 and Tailwind red-600 `#DC2626` is 4.27:1.
Check any replacement against `kPage`, not against white. The heatmap keeps
its own five-stop scale; `heatmapFar` shares the terracotta by coincidence, not
by reference.

No third "disabled" tier. The old `kInkSecondary` (taupe) / `kInkDisabled`
(stone) constants have been **deleted** — every surface is on `kInk` + `kInkMuted`.

**The canvas is grey, not near-white, and this is load-bearing.** `kPage` was
`#F9F9F7` — one step off `#FFFFFF`, which left white cards, hairlines and every
wash with almost nothing to separate from; the app read uniformly subtle on a
phone. `kTrack` and `kHairline` moved down with it by the same delta to keep
their step below the page (at the old value `kTrack` would have been *lighter*
than the canvas — a track reading raised instead of recessed). This deliberately
forks from the web's `--kallo-surface`; do not "resync" the two without
re-deciding it.

**Press wash.** Warm washes are for *selection* and for anything covering a
lighter surface. A control that sits **transparent on the canvas** presses with
`KalloColors.pressWash` (ink @ 6%) instead: the warm washes are lighter than the
canvas, so on the page they composite to within ~3 points of it and the press
simply doesn't register. Warm for selected, ink for pressed-on-page.

## Spacing — one 12px rhythm

`12px` (`KalloSpacing.sp3`) between **all** major stacked components:
greeting ↔ week strip ↔ card title ↔ card ↔ card. Card padding `16` (`sp4`),
card radius `22`. Card padding is **16 horizontal / 12 vertical** where the card
opens or closes on text (`LoggingSpacing.card`): the first and last lines each
carry ~4px of line-height slack above and below their glyphs, so a flat 16 reads
top-heavy. Equal *optically*, not geometrically — that is the one that matters.

The composer goes further (`LoggingSpacing.composer`, 4 sides / 10 top / 4
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

One glyph size and one hit target, app-wide: `KalloIcons.size` **24** on
`KalloIcons.hit` 36 for every icon-only control and every row-leading glyph —
chevrons, steppers, row-removes, composer controls, send/stop, settings rows.
(`LoggingIcons.size`/`.hit` are aliases of these, not independent values.) The
pressed wash hugs the glyph rather than filling the hit box: the target can grow
for accessibility without the press affordance growing with it.

**Stroke weight is 1.5, not Lucide's default 2.0.** Every glyph comes from the
`300` constants (`LucideIcons.user300`, not `LucideIcons.user`) — the package
ships each stroke weight as a separate font family over the same codepoints. At
2.0 a 24pt glyph out-weighs the 14pt label beside it and the row reads
icon-first; 1.5 matches Be Vietnam Pro's stem at w400. 1.0 (`200`) goes lighter
than the text and the ring glyphs (target, info) turn fragile.

Use the const constants, never a runtime-built `IconData`. `IconData`'s
constructor params are `@mustBeConst` so that `--tree-shake-icons` (on by
default for release builds) can strip unused glyphs; a runtime-restroked icon
fails that build or ships the whole Lucide font.

24 is for glyphs that stand alone. A glyph sitting **inside a text run** — a
chip, a meta row, a badge, an inline affirmation — is a different role and stays
at its local 12–16; blanket-24 there makes dense rows top-heavy. The size was 16
everywhere until it read as decoration beside 14pt labels rather than as content.

A row-leading glyph is centred on the **title's first line**, not on the row.
Rows with a subline are two lines tall, and centring across both leaves the icon
floating in the gap. See `settings_row_leading.dart` — the `OverflowBox` there is
load-bearing, not incidental: a 24 glyph is taller than an 18.2 title line, and a
plain `Center` in a tight `SizedBox` would hand the icon a squashed box.

The logging page now holds the three sizes with **no exceptions** — the calorie
ring's label was the last holdout at 8px and is on Meta 12 like every other
caption. Lower-case, not the old uppercase: it keeps Vietnamese ("còn lại")
inside the fixed 78px ring, which uppercase at 12 would not.

Note the trap that hid there. `KalloText` upper-cases its `eyebrow` and
`macroLabel` variants *in the widget*, so a call site moving to plain `Text`
silently loses the transform — and any casing inconsistency in the strings
(`"left"` vs `"Over"`) stops being masked. Normalise casing at the call site
when you port, or check the rendered word, not just the size.

### Status colour

Errors stay red on the **affordance**, not the copy: the alert icon and the
terracotta action button carry the signal while the message itself reads in
`kInkMuted`. A whole card of red text reads as an alarm for something the user
can usually just retry.

## Motion — one named set, and one deliberate fork from web

Durations and curves resolve to `apps/mobile-flutter/lib/theme/kallo_motion.dart`
(`KalloMotion` for durations, `KalloEase` for curves), the same way colour, type
and spacing already did. Before it there were 125 inline
`Duration(milliseconds: N)` literals across 34 values, so "how long is a press"
had no answer you could look up. The distribution was already bimodal — 46 sites
at 150, 15 at 200 — which is a system that existed but was never written down.

| Token | Value | Role |
|-------|-------|------|
| `instant` | 100 | a correction the eye shouldn't read as travel (re-pinning a scrolled tail) |
| `press` | 150 | every tap scale/wash — the app's most common duration |
| `quick` | 200 | a small in-place state change |
| `emphasis` | 300 | a control changing shape (field focus, card expand) |
| `entrance` | 350 | arriving on screen for the first time |
| `morph` | 340 | the date chip ↔ week strip crossfade |
| `page` | 280 | one week of the strip paging |
| `scrollTo` | 400 | a deliberate journey down the feed |
| `drawerOpen` / `drawerClose` | 280 / 220 | the nav drawer |
| `toast` | 2200 | a passive toast's dwell |
| `undoWindow` | 5s | the grace period on anything destructive |
| `stagger` | 50 | between staggered siblings |

**Name the role, not the number.** A call site asking for `press` survives 150
becoming 140; one spelling `Duration(milliseconds: 150)` does not, and a reviewer
can't tell it from a typo.

**The drawer's timing forks from web on purpose.** `tab_scaffold.dart` cited
`components/ui/sheet.tsx` (500ms open / 300ms close, `ease-in-out`) as its source
of truth. Half a second is about twice Material's own drawer, and on a phone it
reads as lag *even when every frame lands*; the web sheet is a pointer-driven
surface where the longer travel reads as deliberate instead. Mobile runs 280/220
on `Curves.fastOutSlowIn`, and closes faster than it opens — a dismissal should
feel like getting out of the way, not like a second animation to sit through.
This is the same kind of decision as "the canvas is grey, not near-white": a
considered divergence, not drift. Do not resync the two without re-deciding it.

**An entrance is for arriving, not for scrolling back.** The feed recycles its
cards, so a card scrolled out and back is destroyed and re-inflated — and a
`FadeInLeft` inside it replays in full, spinning up an `AnimationController` and
an `Opacity` saveLayer per row. Gate entrances on whether the thing is genuinely
new: `MealEntry` uses `loggedAt == null`, since only the live reveal lacks one.

**Animate transforms, not layout.** The drawer slid by animating a `Positioned`
`left:` — a faithful port of the CSS, and a full relayout of the panel subtree
every frame. `SlideTransition` moves the same pixels without touching layout.
Likewise, hand an `AnimatedBuilder` its `child:`: the drawer rebuilt the entire
sidebar (two `ref.watch`es, two `GoRouterState.of` lookups, an SVG parse) about
thirty times per open for a subtree that never changed while it travelled.

**Conditional children in a `Stack` need keys.** The date morph added and removed
its two layers with `if (t < 1)` / `if (t > 0)`. The children list changed length
mid-animation, both branches were unkeyed `Opacity`, so Flutter matched the
surviving strip against the chip's slot, mismatched three levels down, and
destroyed the whole `TimelineStrip` — `PageController`, paged-to week and all —
inside an animation frame. Keep both layers mounted, key them, and gate
hit-testing with `IgnorePointer`.

## Reference implementation (source of truth)

`apps/mobile-flutter/lib/theme/calm_tokens.dart` —
`dashHero` / `dashValue` / `dashBody` / `dashMeta` / `dashEyebrow` /
`dashHeadline`, plus `kInk` / `kInkMuted`. Inter-component spacing lives in
`dashboard_screen.dart` (the `sp3` rhythm) and the section widgets.

## Status / migration

**Validated on device.** The density rules below are the default for all new
mobile UI — no longer provisional.

| Surface | Type + colour | Named spacing | Notes |
|---------|---------------|---------------|-------|
| **Logging** | ✅ 17/14/12 | `logging/logic/logging_spacing.dart` (8px block) | the reference implementation |
| **Dashboard** | ✅ 40/14/12 + Lora 22 | `dashboard/logic/dashboard_spacing.dart` (12px) | Hero replaces Value here |
| **Settings** | ✅ 22/14/12 | `settings/logic/settings_spacing.dart` | rows split 4+8 (below) |
| **Feedback** | ✅ | uses the 12px default | |
| **Shell / drawer** | ✅ | `KalloSpacing` directly | selected state matches web |
| **Circle** | 🔸 header + add-menu + padding only | 12px root inset | the feed's 35 files are unported |
| **Nutrition** | 🔸 range selector + padding | 12px root inset | `dashEyebrow` + raw sizes remain |
| **Logging `sheets/`** | ❌ | — | 4 files, 35 `KalloText` calls, still the old scale |
| **Onboarding / Auth** | 🔸 palette only | deliberately wider (32–40) | narrative screens, not data |

The `kallo_text.dart` `KalloTextVariant` defaults and the logging `mealQuote`
serif remain outside the calm set on purpose.

### Two app-wide changes worth remembering

| Change | Scope |
|--------|-------|
| `dashBody` leading 1.45 → 1.3, `dashMeta` 1.35 → 1.25 | every surface |
| Text scaling capped at 1.3x (`app.dart`) | every surface |

If a screen ever "feels big" again, the leading is still the first lever — two
numbers in `calm_tokens.dart` that move every screen at once.

## Shared widgets the system now owns

Reach for these before writing a local variant:

- **`shared/widgets/scroll_separator.dart`** — a header hairline that only
  exists once content has scrolled. Wraps header + scroll view and listens to
  bubbled `ScrollNotification`, so any scrollable works and a body that swaps
  skeleton→error→list needs no re-plumbing. On every page.
  *Anchor it where the scroll actually starts.* Logging puts it under the macro
  summary, not the date strip, because the summary doesn't move — a rule above
  a static block claims content passed beneath it when none did.
- **`shared/widgets/quiet_action_button.dart`** — the warm-wash pill for
  "commit what I just typed". NOT the umber `KalloButton`, which is reserved for
  the one primary action per surface; a form's own submit is not that one.
- **`logging/widgets/macros/macro_trio.dart`** — P/C/F + kcal as fixed columns. Packed
  left-to-right, the columns drift with the digits and a card of ingredients
  reads ragged.
- **`logging/widgets/meal_time_divider.dart`** — the `── 1:04 AM ──` rule.
  Unsaved cards pass the moment they were entered, so the timeline doesn't
  break at the card being worked on.

### The drawer's selected state

Selected = `KalloColors.hover` (#F0EAE0) wash + `kInk` + semibold. Idle =
`kInkMuted`. This is web parity
(`components/app/navigation/mobile/mobile-nav-list.tsx`). Flutter had it
*inverted* — solid umber with white content, and ink when idle, i.e. the colour
web reserves for selected. Two consequences: a selected row keeps its full wash
while pressed (hover@40 over an opaque wash renders *lighter*, i.e. inverted
feedback), and the badge dot is always tan (white vanished on the wash).

Open question since the canvas went grey: the drawer panel paints `kPage`
(`shell/sidebar.dart`), and the warm wash is now much closer to it, so the
selected row leans harder on ink + semibold than on the wash. If it reads mushy,
the fix is to paint the drawer `kCardSurface` — a slide-in panel is a sheet, and
sheets are white in this system — not to darken `hover`, which is mostly used on
white.

## Traps — each of these shipped a visible bug

**`KalloText` merges.** `base.merge(style)`, so a `dash*` override silently
beats the variant's size. It also upper-cases `eyebrow` and `macroLabel`
*inside the widget*, and defaults `macroValue` to `TextAlign.right`. Moving a
call site to plain `Text` drops the transform silently — check the rendered
word, not just the size. A widget whose `style` defaults to a variant is the
same trap latent: make `style` required.

**`InputDecorationTheme` wins.** The app theme sets `filled: true` and an
`OutlineInputBorder` on `enabledBorder`. Clearing only `border` leaves the
field painting its own box *inside* your container — the nested-card look. Set
`border`, `enabledBorder`, `focusedBorder`, `disabledBorder` **and**
`filled: false`, plus `contentPadding` (the theme's is 16/12).

**Narrow weekday names are not one character.** Vietnamese renders `T2`…`T7`,
`CN`. A fixed 16px gutter wrapped them into a column of stacked letters.
Measure the widest label; don't assume.

**`DateFormat.MMMd` is three tokens in Vietnamese** — "6 thg 7". On a dense
axis use numeric `d/M`: same width in every language.

**Server strings are not localized.** The heatmap's month names were built with
a hardcoded `en-US`, so Vietnamese users read "May / Jun / Jul". Send a number,
format it client-side.

**Vendored twins drift.** `dashboard/logic/heatmap_colors.dart` and
`components/dashboard/progress/heatmap-colors.ts` are byte-identical copies.
Edit both.

**A legend is a key, not a measure.** Sizing the adherence legend's segments to
their real band widths gave the two warm tiers half the bar, reading as "most
of your days are bad" before a cell was drawn. Five equal segments.

**Adherence bands are asymmetric** (`HeatmapBands`): under-target runs
20/30/40/50 against over-target's 10/20/35/50. Most under-target days are
under-*logged*, not under-eaten — a forgotten snack is indistinguishable from a
deficit — so punishing both directions equally painted ordinary days as
failure.

### Row content vs card content

A dashboard **card's edge** sits at 12. Text inside it is further in by the
card's own padding. A settings **row is not a card**, so its content column
lands where a card's edge lands — 12 — not 12 plus the row's padding. Settings
splits that 12 as **4 (list) + 8 (row)** so the net inset matches every other
tab while the pressed fill still floats inside the screen edge.

### Porting a surface

1. Inventory it: `grep -rhoE "KalloTextVariant\.[a-zA-Z]+|dash[A-Z][a-zA-Z]*\(|fontSize: [0-9.]+" <dir> | sort | uniq -c`.
2. Map every hit onto three sizes. More than three on one screen means the
   mapping is wrong, not that the screen is special. Hero 40 and the Lora 22
   greeting are the documented exemptions — one editorial moment per viewport.
3. Replace `KalloText(variant:)` with plain `Text(style: dash*())`, minding the
   merge and uppercase traps above.
4. Name the surface's gaps in one constants file. Presentational surfaces keep
   the 12px default; only a dense scrolling list earns tighter.
5. Strip card-owned bottom margins — the parent stack owns every gap.
6. One glyph size + one hit target for icon-only controls.
7. Audit the third colour: `grep -rn "KalloColors.stone\|textWarm\|textSoft" <dir>`.
8. Re-check on device at 100%, at the smallest Dynamic Type step, **and in
   Vietnamese** — which is where every localization trap above surfaced.
