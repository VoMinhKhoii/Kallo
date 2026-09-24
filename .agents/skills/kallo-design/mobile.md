# Kallo mobile (Flutter) — type, colour & spacing

The **mobile** design system for `apps/mobile-flutter`. It shares the brand core
with web (neutral canvas + warm accent palette, logo, Vietnamese-diacritic rule,
no-emoji, Lucide) but is
a **calmer, Threads / Apple-Health–tuned** system that deliberately **diverges**
from the web type scale and tokens. Do not apply `--kallo-*` CSS tokens, DM Sans,
or the web scale here.

Throughline: **hierarchy comes from weight + colour, not size**; a compact,
uniform vertical rhythm; exactly one editorial serif moment per viewport.

> **Native pass (2026-08-31).** The redesign on branch
> `claude/ios-native-design-system-wizyvk` supersedes several entries below:
> canvas `#F8F7F4` (borderless cards, fourth canvas decision — see
> `kallo_colors.dart`), icon hit target 44, the drawer/hamburger replaced by a
> floating pill tab bar (`lib/shell/nav/`), Log pushed full-screen, a two-tier
> button system (black auth CTA / beige in-app primary, fully rounded),
> full-round 52pt input pills, header ramp 28/600 → 16/600 → 14/500-muted with
> uppercase eyebrows confined to dial labels, and shared
> `GroupedListCard`/`ListRow`/`SectionHeaderRow`/`MealBlock`/`KalloTextField`
> primitives. The approved reference canvas:
> https://claude.ai/code/artifact/aab19668-d483-49b9-b618-9340aed28fe6

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

> **Metric-compensated ramp (2026-09-02).** Supersedes the sizes in the
> Threads-scale callout below; keeps its relationships. The 2026-09-01 ramp
> copied Threads' numbers — body 17, meta 15 — but those are **SF Pro** sizes,
> and the app renders **Be Vietnam Pro**. Measured from the bundled TTFs, BVP's
> cap height is 0.74em against SF Pro's 0.705, its average advance is ~10%
> wider, and it reads one weight step heavier; a nominal 17 therefore rendered
> like an SF 18–19, and the app kept "feeling big" at the reference numbers.
> The ramp is now the SF relationships translated into this face: Body 17 →
> **16** (leading 1.3, tracking −0.2), Meta 15 → **14** (tracking −0.1), Name
> 16 → **15**, Section header 17 → **16**, Group label 15 → **14**, Caption 13 →
> **12**, Page title stays 28 but drops 700 → **600**. Alongside the sizes:
> `ListRow` labels go **regular** (Threads and the Claude app set theirs
> regular — medium made every settings row shout), `kInkMuted` lightens one
> step (`#6E6D66` → `#7A7870`), and the pill nav is **icon-only**. Hero 40 and
> the gauge dials keep their sizes.
>
> **Weight (same pass, second commit).** BVP **Medium (500) reads as
> semibold**, and it was the default on hero, value, group label and eyebrow
> plus ~85 explicit `weight:` call sites (buttons, kcal figures, selected
> segments, day numbers, chips). All of it is now **regular (400)**. Semibold
> (600) survives in exactly three tokens — `kPageTitle`, `kSectionHeader`,
> `dashName` — which is what Threads and the Claude app do: bold the title and
> the author, nothing else. Emphasis everywhere else is colour (ink against
> muted) and size, never weight. Dialog, sheet and empty-state titles that
> used to fake a header with `dashValue` + 600 now use `kSectionHeader`.

> **Threads-scale ramp (2026-09-01).** Supersedes the calm 14/12 ramp below its
> own row. Threads on iOS was measured directly: its feed body is **not** small.
> The density that made it the reference all along comes from a **narrow measure
> and controlled leading**, not from tiny type — and the calm ramp had copied the
> density while shrinking the type, landing Kallo's body two steps under every
> iOS system surface (a Settings row label is 17). Body 14 → **17**, meta
> 12 → **15**, group label 14 → **15**; names get their own 16/600 tier and 13
> becomes a documented by-exception caption. Sizes only — colours, spacing
> tokens, radii, component anatomy and the 12px rhythm are untouched.

| Role | Size | Weight | Leading | Tracking | Used for |
|------|------|--------|---------|----------|----------|
| Hero | 40 | 400 | 1.0 | −1.0 | the ONE big number per card (calories remaining, weight) |
| Page title | 28 | 600 | 1.15 | −0.6 | the screen's name (Nutrition, Circle, Settings) |
| Section header | 16 | 600 | 1.2 | −0.3 | section headers, centred sheet titles, the title on a header line |
| Value | 16 | 400 | 1.1 | — | macro gram values, metric values (dial figures are pinned separately — see _Gauge readouts_) |
| **Body** | **16** | 400 | **1.3** | −0.2 | meal names, post bodies, list-row labels, composer input, button labels |
| **Name** | **15** | **600** | 1.3 | — | an emphasised NAME against 16 body — Circle post/reply authors. Identity only |
| **Meta** | **14** | 400 | 1.25 | −0.1 | captions, units, stat values, dates, quiet values |
| Group label | **14** | 400 | 1.3 | — | muted qualifier above a grouped card ("Targets", "Preferences") |
| **Caption** | **12** | 400 | 1.25 | — | **by exception only** — a compact component 14 measurably breaks |
| Eyebrow | 11 | 400 | 1.3 | +0.3, UPPERCASE | macro-dial labels ONLY (muted) |
| Greeting | 22 | 400 | — | −0.3 | Lora serif — the single editorial moment per viewport |

**Regular is the weight for everything but titles and names.** Be Vietnam Pro
reads heavy — its Medium (500) is what most faces call semibold — so 500 is
not a step, it is bold, and it is gone from every data, label, button and
figure role (2026-09-02). 600 lives in four tokens only: page title, section
header, name — and `kButtonLabel`, the word on a pill BUTTON (2026-09-24: at
400 a beige pill read as a label on a swatch, and the weight had been
re-decided per widget, so "Gửi góp ý" and "Lưu tên" two screens apart wore
different weights; every pill label now reads it from the one token). A
selected segment, today's day number, the total row: all regular, told apart
by ink versus muted. Serif is never bold. If something needs to stand out and colour is not enough, the
answer is size or position, not weight.

**Body 16 vs Name 15.** Two 16s stacked — a w600 name over a w400 body — read as
a wall. Stepping the name down one notch while taking it to semibold keeps the
identity/content relationship. The tier is for identity ONLY: a label that IS
the row's body (a Settings row label, a button, a sheet title) stays at 16.

**Caption 12 is an escape hatch, not a tier.** Reach for Meta 14 first; drop to
12 only when the component measurably overflows, and say why at the call site.
Its uses are all the same shape — a dense numeric cluster sharing one line with
16pt text (the three below, plus the Circle invite card's macro line and
portion pill and the barcode gram-preset chips):

| Where | Why 15 broke |
|-------|--------------|
| `MacroSplit` — the Log card's `P:/C:/F:` cells | at Meta the cells grew to ~54 each and squeezed the dish-name column under what "Top blade áp chảo" needs for its two allowed lines (measured at the old 17/15; at 16/14 it fits by ~3pt on a 390 phone but not at 1.3x, and not on the totals row) |
| `MealBlock` macro legend | three icon+figure pairs plus a ~70pt kcal need ~253pt of legend at Meta — past a 320pt phone's card |
| `ManualAddedSummary` macro legend | same anatomy: ~288pt needed of a 288pt row on a 320pt phone |

The 14pt macro food icons beside them stay 14 — see _Icons_.

**Leading is still the first lever.** Body sits at 1.3 (~21pt) and meta at
1.25 — Threads' relationship, enough air for a two-line wrap without the
paragraph feel 1.5 brings. When a screen "feels big", move the leading before
the sizes: the sizes are now the iOS ramp *after* metric compensation for Be
Vietnam Pro and should stay there. If the typeface ever changes, re-measure
cap height and advance width before touching a single number.

### One scale per surface

A screen picks **at most three sizes**. The logging feed is the reference
implementation: Value 16 for the one figure per card, Body 16 for content, Meta
14 for everything quiet — with the serif quote as the single editorial moment.
Anything outside those three needs a comment saying why.

Do NOT mix `KalloTextVariant` with `dash*` on the same screen. `KalloText` does
`base.merge(style)`, so a `dash*` override silently beats the variant's size and
weight — which is how one card ended up rendering collapsed kcal at Value and
its total kcal three lines below at 16/700 from the legacy scale. On calm surfaces, use plain `Text`
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
| `kPage` | `#F8F7F4` | app canvas — one step below white; cards need NO border/shadow (4th canvas decision, 2026-09-01) |
| `kCardSurface` | `#FFFFFF` | cards / sheets — solid white |
| `kTrack` | `#EDECE7` | ring/bar tracks (warm), the only low-contrast surface |
| `kHairline` | `#E2DFD4` | the one border — neutral hairline |
| `kInk` | `#141413` | primary data — numbers, meal names, macro labels |
| `kInkMuted` | `#7A7870` | everything secondary — labels, units, captions, dates (lightened from `#6E6D66`, 2026-09-02) |

`KalloColors` mirrors these plus `textSoft #3D3D3A` (long body), `hover #F0EAE0`
(warm select wash — also the in-app primary button fill `btnPrimarySoft`; the tab bar's `+` left that tier for `KalloGradients.brandSweep` on 2026-09-10), the accent `#C9A87C`, umber `#695E4E` (toggles/progress only — no longer a button fill),
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

**Secondary text is deliberately under AA.** `kInkMuted #7A7870` measures
4.1:1 on the canvas and 4.4:1 on white — under the 4.5:1 that `kInk`, `danger`
and `mention` are held to. The references it is tuned against sit far lower
(iOS `secondaryLabel` ≈ 3.4:1, Threads' meta grey ≈ 2.9:1), and at the old
`#6E6D66` (4.85:1) the "quiet" tier was barely quieter than the ink beside
it. The rule that follows: muted is for text that *labels* — units, dates,
captions, group labels — never for text a user must read to act (errors,
row labels, values they are editing). White copy on the muted band keeps the
old value (`bandSurface` is pinned to `#6E6D66`, 5.2:1) rather than following.

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

This is the default for every surface. The logging feed's dense-8 exemption
was RETIRED in the native pass (2026-08-31): with borderless cards separating
by surface alone, 8 read as one bruised block — the feed now runs the same
12px rhythm (`logging_spacing.dart`). Going tighter than 12 is a per-surface
decision that must be captured in a named token set, never improvised gap by
gap — and today no surface does.

## Spacing — one rhythm per surface

Gaps resolve to a small named set, not per-widget guesses. The logging feed's
`LoggingSpacing` is the pattern to copy. It runs the same 12px `block` as every
other surface (the dense-8 exemption was retired 2026-08-31, above); what it
adds is the smaller named steps inside a card.

| Token | Value | Used for |
|-------|-------|----------|
| `block` | 12 | between the big blocks — header ↔ list ↔ composer, and card ↔ card |
| `section` | 12 | inside a card: above/below every hairline, between sections |
| `row` | 4 | vertical padding on one item row (so neighbours sit `block` apart) |
| `actions` | 2 | a card ↔ the action icons under it (they carry their own inset) |

**A card never carries a bottom margin.** The parent stack owns the gap — a list
separator or a `Column`'s `spacing`. Margins on both sides silently double, which
is how cards ended up 20px apart when the separator said 8.

### Icons

**Three glyph tiers on ONE hit target** (Threads-derived, 2026-09-01). Icons
carry the same hierarchy the type ramp does. `KalloIcons.hit` stays **44** at
every tier — only the glyph shrinks, so accessibility is untouched. The pressed
wash hugs the glyph rather than filling the hit box, so the target can grow for
accessibility without the press affordance growing with it.

| Token | Size | Role |
|-------|------|------|
| `KalloIcons.primary` | **24** | navigation + primary utility — pill-nav glyphs, settings row leading icons, header icons. The glyph that carries a row or a screen. (`KalloIcons.size` is an alias.) |
| `KalloIcons.action` | **21** | an action ON a card — the Log meal-card action row, discard, the confirm-circle check. At 24 these clusters out-weighed the meal they belonged to. (The Circle post's row is NOT here: it sits on `tertiary`, and has since the Threads pass.) |
| `KalloIcons.tertiary` | **18** | small inline affordances — collapse chevron, copy/remove minis, quiet suffix actions, and **disclosure chevrons** (moved 16 → 18 so the tier has one size, not two neighbouring ones). |

`LoggingIcons.size` is now an alias of `tertiary` and `LoggingIcons.action` of
`action` — the logging surface's compact divergence stands, but it names the
app's tiers instead of private numbers.

**Non-action DATA glyphs are outside the tiers.** The 14pt macro-legend food
icons are content, not controls; they stay 14 (the legend text beside them sits
on Caption 12, so 14 still reads as the larger of the pair).

**A tier is an optical size, not a number.** Three glyphs at the same point size
do not necessarily read as one size: `message-circle` and `copy` are convex and
fill ~20×20 of Lucide's 24 grid, while `heart` covers ~20×17.5 and tapers to a
point, so the Circle post's row read as a big bubble, a big copy and a small
heart at a flat 18. It is compensated per glyph *within* the tier — heart 20,
bubble and copy 17 — and the filled heart takes the same 20 as the outline, or
the post twitches a size as it is hearted.

The compensation is **one table keyed by glyph**, `KalloIcons.optical(icon)`,
not a size argument at each call site. It is a property of the glyph, and as
three per-call-site numbers a fourth glyph added to that row silently got 18
and read a size off from its neighbours. `FilledHeart` reads the same entry as
the outline, so the two states cannot diverge, and `KalloIcons.opticalMax`
feeds the day card's action-row slack (`feed_day_group.dart`) — an assert now,
where it used to be a sentence in a comment one file away from the numbers it
depended on. Add a glyph to the table, not a number to a widget; and do not
read any of this as licence for a fourth tier.

**Stroke weight is 1.5, not Lucide's default 2.0.** Every glyph comes from the
`300` constants (`LucideIcons.user300`, not `LucideIcons.user`) — the package
ships each stroke weight as a separate font family over the same codepoints. At
2.0 a 24pt glyph out-weighs the label beside it and the row reads
icon-first; 1.5 matches Be Vietnam Pro's stem at w400. 1.0 (`200`) goes lighter
than the text and the ring glyphs (target, info) turn fragile.

**The pill nav's ACTIVE tab is the one sanctioned `400`** (2026-09-03). The
selected tab used to differ from its neighbours by colour alone (`kInk` vs
`kInkMuted`), which at 24pt on a white capsule is not enough to find your place
at a glance. The active glyph now renders the `400` (2.0) family — same
codepoint, heavier stem — and every other icon in the app, this bar's idle tabs
included, stays on `300`. No crossfade: the swap is instant, because a
tab-selection change is not travel. This is the exception, not a loosening.

Use the const constants, never a runtime-built `IconData`. `IconData`'s
constructor params are `@mustBeConst` so that `--tree-shake-icons` (on by
default for release builds) can strip unused glyphs; a runtime-restroked icon
fails that build or ships the whole Lucide font.

24 is for glyphs that stand alone. A glyph sitting **inside a text run** — a
chip, a meta row, a badge, an inline affirmation — is a different role and stays
at its local 12–16; blanket-24 there makes dense rows top-heavy. The size was 16
everywhere until it read as decoration beside the row labels rather than as
content.

A row-leading glyph is centred on the **title's first line**, not on the row.
Rows with a subline are two lines tall, and centring across both leaves the icon
floating in the gap. `ListRow` (`shared/widgets/list/list_row.dart`) owns this
anatomy: a 24 glyph in a 24-wide slot beside a 21pt title line.

The logging page now holds the three sizes with **no exceptions** — the calorie
ring's label was the last holdout at 8px and is on Meta like every other
caption. Lower-case, not the old uppercase: it keeps Vietnamese ("còn lại")
inside the fixed 78px ring, which uppercase would not.

Note the trap that hid there. `KalloText` upper-cases its `eyebrow` and
`macroLabel` variants *in the widget*, so a call site moving to plain `Text`
silently loses the transform — and any casing inconsistency in the strings
(`"left"` vs `"Over"`) stops being masked. Normalise casing at the call site
when you port, or check the rendered word, not just the size.

#### Illustrations

Surface states — empty, error, 404 — carry a hand-drawn Koboyo illustration,
the same cast as the web (capybara Circle, otter Logging, sloth Nutrition,
hedgehog Dashboard, seal for system surfaces; pose = state; the animal's
sleeping pose from 22:00 to 05:00 via `shared/logic/time_of_day.dart`). They
ship as ink-baked SVGs in `assets/illustrations/` (generated by the repo-root
`scripts/assets/gen-illustrations.mjs`) and render through
`shared/widgets/brand/surface_illustration.dart` — `SvgPicture.asset` with a
`ColorFilter` to `KalloColors.text`, **120pt** tall, **64pt** inside a card,
width following the viewBox. `KalloSurfaceState` is the only consumer: never
place one beside a row or inside a chip, never on a disc, never tinted tan.
Lucide stays the glyph set for everything else.

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
| `toast` | 2200 | a passive toast's dwell |
| `undoWindow` | 5s | the grace period on anything destructive |
| `stagger` | 50 | between staggered siblings |

**Name the role, not the number.** A call site asking for `press` survives 150
becoming 140; one spelling `Duration(milliseconds: 150)` does not, and a reviewer
can't tell it from a typo.

**The drawer retired with the pill nav** (native pass, 2026-08-31), and its
280/220 timings went with it. The lesson it taught stays: a mobile surface
ported from a pointer-driven web sheet must re-derive its motion — half a
second reads as lag on a phone even when every frame lands, and a dismissal
should always run faster than an arrival.
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

## Platform — Cupertino wherever it exists

**Where Flutter ships a Cupertino widget or behaviour for the thing you are
building, use it.** Kallo is an iOS-first product, and Material's three tells —
the ink ripple, the spinning arc, the bottom-up page transition — are what make
an app read as "a Flutter app" rather than as an app. None of them is a taste
call the design system gets to make differently per surface.

**The burden of proof inverted, 2026-09-19.** The rule used to carry an escape
hatch wide enough to park the whole app in — *"a widget the app already owns
beats both"* — and it was read as standing permission: the hand-rolled version
won by default and nobody had to say why. The measurement that settled it: 387
of 598 Dart files import `material.dart`, seven import `cupertino.dart`.

So it is now the other way round. **Cupertino wins by default. A widget the app
owns survives only where its own doc comment names a specific defect in the
Cupertino equivalent — a measured number, a reproduced bug, or a system rule it
breaks — and names the trigger that retires the exception.** "We already have
one", "ours is themed to the app" and "it works today" are not defects. An
exception with no citation is a bug, and the next person to touch the file
deletes the wrapper.

Three survive that test today, each re-verified against Flutter 3.44.1:
`showKalloAnchoredMenu`, `KalloAlertSurface` and `KalloConfirmActions` (see
boundary 3). `TopToast` is not an exception at all — Cupertino ships no toast,
so there is nothing to prefer over it.

| Instead of | Use | State |
|------------|-----|-------|
| `CircularProgressIndicator` | `CupertinoActivityIndicator` | ✅ done 2026-09-19, all 13 sites (the doc claimed 17; the real count was 13). `CupertinoActivityIndicator` builds its own `SizedBox.square(dimension: radius * 2)`, so `radius` N/2 replaced each `SizedBox(N)` + `strokeWidth: 2` pair at identical dimensions and the wrapper went away with it. Seven of the 13 files stopped importing `material.dart` entirely |
| a bottom-up Material page transition | `KalloSwipeBackTransitionsBuilder` in the theme (`shell/nav/swipe_back/`) — Cupertino's slide plus a back drag that starts anywhere, not on a 20pt edge | ✅ done 2026-09-10, app-wide. **See *Routes* below — this is the one row where `Material*` is the Cupertino answer.** |
| `showModalBottomSheet` | `showSheet` → `SheetRoute extends CupertinoSheetRoute` (`shared/widgets/sheet/sheet_route.dart`) | **migrating 2026-09-19.** Do NOT call `showCupertinoSheet`: it never forwards `showDragHandle` (`sheet.dart:202,241`), and a custom `topGap` nulls `delegatedTransition` (`:819`) — which, since `barrierColor` is a hardcoded transparent (`:777`), is the only thing that dims the screen behind a sheet |
| `InkWell` / `InkResponse` ripple | `CupertinoButton`, or `KalloPressable` where the press must survive the gesture arena | **2 sites** (`quiet_action_button.dart`, `meal_action_icon_button.dart`) |
| `RefreshIndicator` | `CupertinoSliverRefreshControl`, via `KalloRefreshableScroll` | ✅ done |
| `AlertDialog` / `showDialog` | `showKalloConfirm` (a Cupertino alert route) | ✅ done |
| `Switch` / `Switch.adaptive` | `CupertinoSwitch` | **migrating 2026-09-19.** Retires the `trackColor` workaround `Switch.adaptive` needed, since `_SwitchThemeAdaptation.adapt()` discards the ambient theme on iOS |
| `TextField` | `CupertinoTextField` (`CupertinoSearchTextField` for a search row) | **18 sites.** The decoration currently comes from `inputDecorationTheme`; it is a flat map and re-expresses as one `BoxDecoration` |
| a segmented control | `CupertinoSlidingSegmentedControl` | `SegmentedStrip` — a **pill** track and thumb, which is the iOS 26 shape; Flutter's Cupertino control still draws the iOS 13–18 rounded rectangle. An `OptionStripItem.icon` draws inline before its label (feedback's bug / sprout / lightbulb). The `.onboarding`/`.settings` hint skins retired 2026-09-24 with their last callers: a choice that needs a hint is an `OptionRow` with a subline |
| `Slider` | `CupertinoSlider` | **1 site** (`cheat_slider_card.dart`; Settings' `AggressionSlider` retired 2026-09-24 — the goal page uses onboarding's pace ruler). No `SliderTheme` — the 4pt track and 9pt thumb are not expressible |
| `Scaffold` | `CupertinoPageScaffold` | 8 sites. `tab_scaffold.dart` stays on `Scaffold`: `extendBody` + the `MediaQuery.padding.bottom` rewrite that lets the pill nav overlap content has no Cupertino analogue |
| long-press menu | `showKalloAnchoredMenu` | **exception** — cites `_kOpenScale = 1.15` and `_previewLongPressTimeout = 800ms`, boundary 3 |
| `SnackBar` | `TopToast` | not an exception — Cupertino ships no toast |
| a pushed page's inline title bar | `CupertinoNavigationBar`, via `InlineNavBar` (`shared/widgets/chrome/`) | ✅ done 2026-09-24 — the SDK bar owns the layout; the app sets type, ink and a clear, borderless, unblurred background. **Exception inside it: the back button.** `CupertinoNavigationBarBackButton` draws its chevron from the `CupertinoIcons` font, which the app does not ship (no `cupertino_icons` dependency), so it rendered a missing-glyph box; the leading slot is a `CupertinoButton` with the Lucide chevron and the SDK's 12-character "Back" rule. Retire if `cupertino_icons` is ever bundled |
| `ClampingScrollPhysics` on a PAGE | `BouncingScrollPhysics` (the iOS rubber-band) | sheets clamp on purpose — a bounce fights the drag-to-dismiss |
| a date/time picker | `CupertinoDatePicker` | none in the app yet; use it when one is needed |

### Routes — the one place more Cupertino is less iOS

`CupertinoPage` and `CupertinoPageRoute` build their own transition and never
read `pageTransitionsTheme`, so using one opts that route **out** of
`KalloSwipeBackTransitionsBuilder` and back onto iOS's 20pt edge drag. Since
2026-09-10 the transition lives in the theme, which makes `MaterialPage` /
`MaterialPageRoute` the *correct* type app-wide — the Cupertino anatomy and
timing arrive through the theme instead of through the route class.

This is not a hole in the rule; it is boundary 2 working. Take the platform's
behaviour, through whichever seam lets the app keep one thing about it. Do not
"fix" a `MaterialPageRoute` into a `CupertinoPageRoute` here.
`test/shell/swipe_back_test.dart` will catch you.

### Where Cupertino stops

The rule is "prefer Cupertino to Material", not "be a Cupertino app". Three
boundaries, each of which has already cost a bug when crossed:

1. **The app stays on `MaterialApp`.** Every token this document defines hangs
   off `ThemeData` — the text theme, `InputDecorationTheme`, `dialogTheme`,
   `popupMenuTheme` — and `TextField` / `InkWell` descendants need a `Material`
   ancestor to resolve at all (`kallo_screen.dart` mounts a transparent one for
   exactly this). `CupertinoApp` would throw all of that away to gain nothing
   the widget-level choice does not already give. Cupertino is used at the
   **widget** level.

   The corollary bites when you leave Material: a Cupertino *route* gives its
   content no `Material` ancestor (`CupertinoSheetRoute.buildContent` is
   `removePadding` → clip → your builder, and nothing else), so every
   `IconButton`, `TextField` and `Divider` inside throws *"No Material widget
   found"* — at runtime, never at `flutter analyze` — and bare `Text` falls back
   to `WidgetsApp`'s red-and-yellow debug style. Wrap the route's content in
   `Material(type: MaterialType.transparency)` once, at the opener.

2. **The design system wins on look; the platform wins on behaviour.** Take
   Cupertino's anatomy, gestures and timing — then override anything that
   carries SF Pro, system blue, or a frosted surface. The type is always Be
   Vietnam Pro and the palette is always this document's. `kallo_confirm.dart`
   is the worked example: a 270pt iOS alert with stacked full-width actions and
   0.5pt hairlines, wearing the app's type, the app's scrim, and — since
   2026-09-07 — a **solid** card in place of `CupertinoPopupSurface`'s
   translucent one, because "solid surfaces, no stacked translucency" is a
   system rule that outranks the platform default.

   Note what this boundary is *not*. It licenses overriding a Cupertino widget's
   paint; it does not license declining the widget. `CupertinoSlider` has no
   themable track, and the answer is to adopt it and accept the track, not to
   keep Material's.

3. **A widget the app owns needs a cited defect.** Not "we own one" — a named
   failure in the Cupertino equivalent, with the trigger that retires the
   exception. Three qualify, all re-verified on Flutter 3.44.1:

   - **`showKalloAnchoredMenu`** over `CupertinoContextMenu`.
     `_kOpenScale = 1.15` and `_previewLongPressTimeout = 800ms`
     (`src/cupertino/context_menu.dart:23,41`): the context menu RELOCATES the
     pressed widget into a preview slot of its own and scales it, so a sent
     message slid out from under the finger holding it, and it dresses the
     action rows in system chrome rather than Be Vietnam Pro. Cost the most to
     learn (2026-09-08). *Retire when `CupertinoContextMenu` can present
     in place.* Guarded by `test/features/logging/user_message_bubble_test.dart`.
   - **`KalloAlertSurface`** over `CupertinoPopupSurface`. Translucent by
     default; "solid surfaces, no stacked translucency" is a system rule.
     *Retire if that rule changes, not if the SDK does.*
   - **`KalloConfirmActions`** over `CupertinoAlertDialog`'s action layout.
     Side-by-side buttons make two short Vietnamese verbs ("Xoá" / "Huỷ") read
     as one ambiguous pair. *Retire when the platform stacks short labels.*

   `KalloPressable` is the fourth, and its defect is the gesture arena:
   `CupertinoButton` resolves through it, so a competing long-press recognizer
   cancels the press wash with the finger still down — the bug
   `test/shared/widgets/dialog/kallo_confirm_hold_test.dart` exists to catch.
   Use `CupertinoButton` where no such recognizer competes.

   Everything else that used to shelter here lost its exemption on 2026-09-19.

## Reference implementation (source of truth)

`apps/mobile-flutter/lib/theme/calm_tokens.dart` —
`dashHero` / `dashValue` / `dashBody` / `dashName` / `dashMeta` /
`dashCaption` / `dashEyebrow` / `dashHeadline`, plus `kInk` / `kInkMuted`. Inter-component spacing lives in
`dashboard_screen.dart` (the `sp3` rhythm) and the section widgets.

## Status / migration

**Validated on device.** The density rules below are the default for all new
mobile UI — no longer provisional.

| Surface | Type + colour | Named spacing | Notes |
|---------|---------------|---------------|-------|
| **Logging** | ✅ 16/16/14 | `logging/logic/logging_spacing.dart` (12px block) | the reference implementation |
| **Dashboard** | ✅ 40/16/14 + Lora 22 | `dashboard/logic/dashboard_spacing.dart` (12px) | Hero replaces Value here |
| **Settings** | ✅ 28/16/14 | `settings/logic/settings_spacing.dart` | root keeps the 28pt `PageHeader`; every sub-page wears `InlineNavBar` (‹ Cài đặt + centred 16/600). The nutrition-profile rows ARE the onboarding steps, hosted by `SettingsStepPage` with a `SaveDock` (2026-09-24) |
| **Feedback** | ✅ | uses the 12px default | |
| **Shell / pill nav** | ✅ | `KalloSpacing` + `kNav*` tokens | drawer/hamburger retired 2026-08-31; Log pushes full-screen |
| **Circle** | ✅ (2026-09-02) | 12px root inset | feed, invite, share and group widgets all on `dash*` |
| **Nutrition** | ✅ (2026-09-02) | 12px root inset | micronutrients are a bordered 2-col grid (see `DESIGN_SYSTEM.md`, *Grid cells*) |
| **Logging `sheets/`** | ✅ (2026-09-02) | — | barcode + manual sheets ported; no `KalloText` left |
| **Onboarding / Auth** | 🔸 palette only | deliberately wider (32–40) | narrative screens, not data |

`kallo_text.dart` / `KalloTextVariant` and `KalloTextStyles` sizes now survive
only on the light-touch narrative surfaces (auth, onboarding, paywall) and in
a few shared form internals; do not add new call sites.

### Cupertino migration (open, 2026-09-07; re-scoped 2026-09-19)

The platform rule above was written down after the fact, so it starts with a
backlog. The 2026-09-19 inversion turned most of the "documented exceptions"
back into backlog: only a cited defect keeps a hand-rolled widget now.

| Item | Sites | Notes |
|------|-------|-------|
| `showModalBottomSheet` → `SheetRoute` | 15 | the largest item. `showNhamSheet` → `showSheet`; height becomes a `SheetHeight` tier because `CupertinoSheetRoute` has no content-hugging mode; the keyboard inset moves into `SheetSurface`. Known regressions recorded at the call site: the scrim drops from Material's 54% to the SDK's 10% (`_kOpacityTween`, `sheet.dart:74`), and `country_sheet`'s custom barrier colour is un-preservable |
| ~~`CircularProgressIndicator` → `CupertinoActivityIndicator`~~ | 0 | **Done 2026-09-19.** All 13 sites; `lib/` now has zero. Was the most visible of the three tells, since every button's loading state showed one |
| `TextField` → `CupertinoTextField` | 18 | re-express `inputDecorationTheme` (`kallo_theme.dart:274`) as a `BoxDecoration` on the wrapper, then delete the theme entry rather than leaving it dead like `snackBarTheme` and `appBarTheme` already are |
| `Scaffold` → `CupertinoPageScaffold` | 8 | auth ×3, onboarding ×4. `tab_scaffold.dart` stays — see the table above |
| a segmented control → `CupertinoSlidingSegmentedControl` | 7 `SegmentedStrip` sites | loses the pop-then-travel thumb and `HapticFeedback.selectionClick()` |
| `Switch.adaptive` → `CupertinoSwitch` | 1 file | deletes the `trackColor` workaround it needed |
| `InkWell`/`InkResponse` → `CupertinoButton` | 2 | `quiet_action_button.dart`, `meal_action_icon_button.dart`. Both also drop a `Material(` wrapper; the `Ink` decoration must become a plain `Container` when the Material ancestor goes |
| `Slider` → `CupertinoSlider` | 1 | no longer "decide first" — boundary 2 says adopt it and accept the track. (3 until 2026-09-19, 2 until 2026-09-24, when `AggressionSlider` went with Settings' own goal form) |
| arena-driven `_pressed` (`onTapDown`/`onTapUp`/`onTapCancel`) → `KalloPressable` | ~40 | `KalloButton`, `sheet_confirm_button.dart`, `app_header_back_button.dart`, the timeline cells, … Every one of these drops its wash the moment a tap recognizer loses the arena — to a long press at ~500ms, or to a scroll — with the finger still down; the confirm dialog shipped exactly that bug before it moved. Not blocking; migrate as each file is next touched |
| ~~`MaterialPageRoute` → `CupertinoPageRoute`~~ | 0, the OTHER way | **Reversed 2026-09-10, reaffirmed 2026-09-19, done 2026-09-24.** The transition lives in the theme, so `MaterialPageRoute` is what the app wants everywhere. The four settings pushes that were `CupertinoPageRoute` — the reason paging through Settings slid and swiped unlike every other screen — now go through `pushSettingsPage` (`settings/widgets/chrome/settings_navigator.dart`). See *Routes* above |

### Two app-wide changes worth remembering

| Change | Scope |
|--------|-------|
| `dashBody` leading 1.45 → 1.3, `dashMeta` 1.35 → 1.25 | every surface |
| Text scaling capped at 1.3x (`app.dart`) | every surface |
| **Threads scale (2026-09-01): `dashBody` 14 → 17 (leading 1.35), `dashMeta` 12 → 15, `kGroupLabel` 14 → 15** | every surface |
| **Metric compensation (2026-09-02): `dashBody` 17 → 16 (leading 1.3, −0.2), `dashMeta` 15 → 14 (−0.1), `dashName` 16 → 15, `kSectionHeader` 17 → 16, `kGroupLabel` 15 → 14, `dashCaption` 13 → 12, `kPageTitle` 700 → 600; `kInkMuted` lightened; `ListRow` regular; nav icon-only** | every surface |
| **Weight (2026-09-02): every 500 → 400 (hero, value, group label, eyebrow, ~85 call sites); 600 only on `kPageTitle` / `kSectionHeader` / `dashName`** | every surface |

If a screen ever "feels big" again, the leading is still the first lever — two
numbers in `calm_tokens.dart` that move every screen at once.

## Shared widgets the system now owns

Reach for these before writing a local variant:

- **`shared/widgets/chrome/inline_nav_bar.dart`** — the bar for a page ONE
  level down: "‹ parent" (falls back to "Back" when it would crowd the title)
  and the title centred at `kSectionHeader`. `.page` for a pushed page, the
  plain constructor inside a sheet (`KalloSheetSubHeader`). The large
  left-aligned `PageHeader` is only for the root of a stack.
- **`shared/widgets/form/save_dock.dart`** — the one "save what I changed"
  button of an edit page, docked on the bottom edge and present only while
  there is something to save. Hand it to `ScrollSeparator.overlay`.
- **`shared/widgets/form/option_row.dart`** — the one-of-many pick with a
  radio. Its height is a floor: label and subline wrap (two-line content sits
  12pt from the edges, 4pt apart) rather than ellipsising a Vietnamese hint.
  `trailing` takes a decoration such as the cooking step's portion drawings.

- **`shared/widgets/feedback/kallo_surface_state.dart`** — the one empty /
  error / 404 anatomy: area illustration → serif title → muted line → one
  action in the black `KalloButtonVariant.cta` (`compact` for in-card) — the
  one sanctioned use of the ink pill outside auth and the paywall. It replaced `KalloEmptyState` and the
  `SeedMark`; the paywall lock card uses `.withMark` to keep the anatomy
  with its own glyph.
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

### The pill nav (replaces the drawer, 2026-08-31)

`lib/shell/nav/pill_nav_bar.dart`: a floating 358×72 white capsule (radius 36,
`kNavShadows` — the nav is TRUE elevation), four tabs as 24pt stroke glyphs
alone (ink when active, muted idle — icon-only since 2026-09-02, the tab name
lives in `Semantics`; `kNavShowsLabels` restores 10pt regular labels), Nutrition's
glyph is the apple, and a 52pt `+` circle opening
the Add sheet (Log a meal / Log weight). That disc wears
`KalloGradients.brandSweep` (apricot `#FFD2B0` → lilac `#DCC4FF`, diagonal, full
opacity) since 2026-09-10 — the onboarding aurora's two hues, saturated: it is
the app's one always-present create affordance, and the flat beige
`btnPrimarySoft` read as chrome on a white capsule. The aurora's own 0.16–0.55
alphas cannot be reused at 52pt; they composite to within a few points of white
over that area. Ink clears AA on both stops (13.2:1 / 11.7:1), so the glyph
stays on the two-colour system. Today/Nutrition/Circle switch shell
branches; **Log pushes the feed full-screen** (a root `MaterialPage` — the
composer owns that screen's bottom edge; a back chevron in the timeline picker
returns to the previous tab). The bar slides away while the keyboard is up.
Settings pushes from the dashboard avatar (`profile_avatar_button.dart`),
which carries the onboarding pulse-dot; the invite badge moved to the Circle
tab. This is a sanctioned divergence from the web mobile drawer.

## Traps — each of these shipped a visible bug

**`KalloText` merges.** `base.merge(style)`, so a `dash*` override silently
beats the variant's size. It also upper-cases `eyebrow` and `macroLabel`
*inside the widget*, and defaults `macroValue` to `TextAlign.right`. Moving a
call site to plain `Text` drops the transform silently — check the rendered
word, not just the size. A widget whose `style` defaults to a variant is the
same trap latent: make `style` required.

**A `Container` `alignment` is not a shrink-wrap.** It is an `Align` with NO
size factors, so it grows to any FINITE max width it is offered. `KalloPressable`
sized its box that way, and inside a `Row` — which offers children unbounded
width — it shrink-wrapped by accident. Move the same child into a `Wrap` and the
Wrap offers the COLUMN's width: every `FeedActionButton` in the Circle action
row became column-wide and the three actions stacked one per line, which is how
"a Wrap lays out identically to a Row" turned out to be false. Fixed 2026-09-08
with an explicit `Align(widthFactor: 1, heightFactor: 1)`
(`shared/widgets/surface/kallo_pressable.dart`, *Sizing*). A height-only
assertion cannot see this — assert the three tops are EQUAL and the lefts
increase (`test/features/circle/circle_feed_widgets_test.dart`).

**A nested tap target must claim its pointer — disabled included.** A pressable
inside another pressable washes ALONE: the innermost claims the pointer up a
`PressScope` chain, so a tap on the heart does not also grey the post it sits
on. The half that is easy to get wrong is the DISABLED one — a `GestureDetector`
with only null callbacks registers no recognizer at all, so the target never
enters the arena and the tap falls through to whatever is behind it. The Circle
heart is `onTap: null` while its reaction request is in flight, inside a post
that opens the thread, so a double tap on the heart navigated away
mid-reaction. A disabled control is still a control; iOS never lets a dimmed
button's tap reach what is under it. Fixed 2026-09-08 — an inert non-null
callback keeps the arena entry (`shared/widgets/surface/kallo_pressable.dart`,
*Nesting*; the protocol is in `shared/widgets/surface/press_scope.dart`).

**An icon row's gaps are the sum of its paddings, and they move.** The Circle
post's three actions sat in a `Wrap` with no `spacing:`, each button paying a
different inset — 0 for a glyph-only one, 10 for a labelled one, plus a 44pt
`minWidth` that padded the leading button's box with 26pt of trailing dead
space. Measured, the ink landed 39 and 23 apart, and a like count appearing
MOVED the neighbours. A row of equal gaps is one constant on every side of
every button, boxes touching, with the minimum width dropped wherever the
alignment already pins the glyph — never a per-button guess. Fixed 2026-09-10;
`circle_feed_widgets_test.dart` measures the ink rects, not the boxes, because
the boxes were never the thing that looked wrong.

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
