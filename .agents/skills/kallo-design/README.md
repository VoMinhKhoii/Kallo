# Kallo Design System

> *Cái duy nhất đủ tinh để theo dõi bữa cơm Việt là mô tả nó bằng lời.*
> The only tracking method accurate enough for Vietnamese home cooking is natural language description.

**Kallo** (read: "n-yum", roughly — to *recite quietly under one's breath*, also colloquially "to estimate roughly in your head") is an AI-powered Vietnamese meal tracker. You describe your meal the way you'd describe it to a friend — `2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh chua` — and Kallo decomposes it into Vietnamese ingredients, looks up real Vietnamese food-composition data, layers in your personal cooking-habit profile (oil usage, rice portion, broth tendencies), and returns a *bounded* calorie + macro estimate. No barcode scanning. No 12-step food-search. No Western databases pretending phở bò and phở gà are the same dish.

The product is built as a single Next.js app with two surfaces:

1. **Marketing site** — the public landing page that explains the pitch.
2. **App** — the authenticated product. Three core screens:
   - **Logging** — the natural-language meal composer + a timeline of saved meals.
   - **Dashboard** — today's calorie ring, weight trend, weekly adherence heatmap.
   - **Nutrition** — long-term macro + micronutrient patterns with confidence labels.

The visual direction is **Apple Notes on cream paper** — warm, beigy, restrained, more typography than chrome. Less is more; the user's own words are the loudest thing on the screen.

---

## Sources

This design system was reverse-engineered from a single source of truth:

- **GitHub** — `VoMinhKhoii/Nham` — https://github.com/VoMinhKhoii/Nham
  - `app/globals.css` — full color token table (the `--kallo-*` namespace)
  - `components/landing-page/*` — hero, problem, solution, CTA, footer
  - `components/app/desktop-sidebar.tsx` — sidebar pattern, expand/collapse rail
  - `components/dashboard/*` — today dock, progress story, adherence heatmap
  - `components/logging/*` — meal input, persisted meal cards, timeline
  - `components/ui/button.tsx` — `landing-primary`, `hero-dark`, `header-cta` variants
  - `messages/en.json` and `messages/vi.json` — every line of UI copy, in both languages

If you have read access to the repo, **go read it directly** — there is far more nuance in the real components (the spring animations on macro bars, the heatmap color logic, the streaming meal-analysis phases) than this kit captures. This system is a workbench, not a replacement.

The product is bilingual (`en` / `vi`) using `next-intl`. Every string in the running product has a Vietnamese counterpart; when you write new copy, write it so a translator could mirror it cleanly.

---

## Content fundamentals

**Voice.** Calm, plain, slightly poetic. Kallo sounds like a thoughtful older sibling who cooks. It explains, it doesn't sell. It admits uncertainty rather than faking precision.

- *"A blank page, for now."*
- *"Log a few meals and your weekly pattern will start to take shape here, gently."*
- *"A quiet stretch. Keep logging to sharpen the pattern."*
- *"Useful uncertainty, not fake certainty."*
- *"Bounded estimates so you can make better decisions without pretending the data is perfect."*

**Person.** Second person, intimate. *"What did you eat?"* not *"Log a meal"*. *"Your estimates are using default settings"* not *"Settings incomplete"*. The product talks **to you**, not **about itself**.

**Casing.**
- **Sentence case** for everything — buttons, links, headings, titles. Never Title Case.
- **UPPERCASE eyebrows** — small (10px) label strings above sections, letter-spaced 0.2em: `THIS WEEK`, `PROGRESS`, `CONSISTENCY`, `AI NUTRITION ANALYSIS`, `PATTERN ANALYSIS`. This is the only place ALL CAPS appears.
- Buttons read like spoken phrases: *Get started*, *See how it works*, *Log a meal*, *Try again*, *Resume profile*, *Show food ideas*. Never `BUTTON_TEXT`, never `Click here`.

**Vietnamese-English mixing.** This is a Vietnamese product written in English. The example meal in the hero is `2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh chua` — Vietnamese diacritics preserved, plus-signs and `gr` units intact. **Never anglicize Vietnamese dish names.** Use `bún chả`, not "rice noodles with grilled pork". Use `mực kho`, not "braised squid".

**Microcopy quirks.**
- Loading states are gentle and active: *"Breaking down your meal…"*, *"Matching ingredients…"*, *"Estimating nutrition…"*, *"Putting it all together…"* — never the bare word "Loading".
- Empty states are full sentences with a soft CTA. *"No meals yet today. What did you eat?"*
- Errors are first-person from the user's POV: *"Could not load this day"*, *"Failed to save weight"*. They suggest a fix, never blame.
- The trust line: *"3 logged days · 84% avg confidence · 30 days view"* — em-dot separator (`·`, not `|` or `•`), units never abbreviated to fake precision.
- Adherence labels are diverging and qualitative: `On target`, `Slightly over`, `Slightly under`, `Over`, `Under`, `Far over`, `Far under` — never a raw percentage on its own.

**Tone for AI output.** Confidence is *labelled*, not hidden. Estimates come with a range (`760–845 kcal`), and the upper bound is highlighted when the user's goal is cutting. The product never claims to know exact calories.

**Emoji.** **None.** Not in copy, not in chip labels, not in empty states. The only "icons" in running text are lucide-react glyphs and section dots.

**Vibe.** If the dashboard feels like a moleskine being filled in with a fountain pen, you're close.

---

## Visual foundations

**Background.** A single warm cream — `#fefbf6` — fills the app. Cards sit on it as plain white (`#ffffff`) with hairline borders. No texture, no noise, no gradient meshes, no full-bleed photography. The hero is the one exception: two enormous **blurred radial blobs** (`#E8D5B5/20`, 120px blur, top-right + bottom-left) sit behind the phone mockup as the *only* decorative flourish in the entire product. There is one optional `.noise-bg` utility shipped in `globals.css` — used nowhere in practice. Keep it that way.

**Type system.** Two typefaces, doing very different jobs.
- **Lora** (serif) — every headline, every number bigger than 18px, every quoted meal string, every "feature" title. Always *normal weight* (`font-weight: 400` or `300`); never bold. The signature move is the second clause of a headline rendered in **italic + light + tan** (`#c9a87c`, weight 300, italic) — `Track Vietnamese meals` / *`without the guesswork`*.
- **Be Vietnam Pro** (sans-serif) — every button, every label, every paragraph below 18px, every uppercase eyebrow, every tabular macro number. Weights used: 400 / 500 / 600 / 700. (It replaced DM Sans as the primary UI sans web-wide — near-identical geometry with full Vietnamese diacritic coverage; DM Sans survives only as a legacy fallback in old mocks.)
- Numbers are always **tabular** (`font-variant-numeric: tabular-nums`) so totals don't jitter.

**Color.** A warm cream canvas carrying **neutral ink**. Text in the app is a two-step neutral pair: primary ink `#141413` (`--kallo-ink` — names, values, titles, active labels) and muted ink `#6E6D66` (`--kallo-ink-muted` — metadata, timestamps, idle labels, placeholders). Muted never gets lighter — fog-class values like `#B0AEA5` are retired for contrast. Hairlines, dividers, and letter-discs are `#E8E6DC` (`--kallo-hairline`). The umber CTA `--kallo-btn` is **punctuation, not paint**: exactly one primary action per surface, never two in the same viewport; every secondary action is border-only or plain text. Tan `#c9a87c` survives in the Lora-italic accent clause and focus rings only — unread dots and ambient indicators are neutral `#141413`. (Espresso `#2c2416` / taupe `#8b7355` linger in legacy marketing surfaces; new work uses the neutral pair.) Macros are *not* a separate palette — protein = tan, carbs = taupe, fat = a cool stone gray. Status colors are deliberately warm: success is a leafy sage (`#7ca368`), danger is terracotta (`#d37b69`) — and danger ink appears only inside confirmation dialogs, never on the triggering row. **No pure red, no pure green, no electric blue, no purple gradients, ever.**

**Spacing.** A 4-px base scale (0.25rem multiples). Density skews **generous** — cards have 16–20px of internal padding, sections have 24–32px gaps. The dashboard breathes.

**Borders.** Almost everything is a hairline — `1px solid #E8E6DC` in the app (the neutral hairline; the biscotti `#e8d5b5` remains on legacy marketing surfaces). Borders are *softer* than backgrounds and the product almost never uses a thick or accent-colored border. Inputs are `#E8E6DC` hairlines whose bottom edge darkens to `#141413` on focus for in-place editors; classic boxed inputs may keep the tan focus ring.

**Corner radii.** Rounded but never circular — the family sits on Anthropic's 4/6/8/12/16 scale (base `--radius: 0.5rem`):
- 8 (`--radius-lg`) — inputs, small buttons
- 12 (`--radius-xl`) — chips, suggestion pills
- 16 (`--radius-2xl`) — most cards, meal entries
- 20 (`--radius-3xl`) — feature panels, the "Today" dock
- 24 (`--radius-4xl`) — the hero phone bezel
- `9999px` — avatar circles, the floating meal trigger pill, the input bar's submit button

Submit buttons inside input bars are a **smaller, slightly square** rounded rect (`rounded-lg`), not a circle — see `meal-input.tsx`. This is intentional and consistent across logging and dashboard.

**Shadows.** Minimal-shadow philosophy (per Anthropic): depth comes from surface color-blocking (cream ↔ white ↔ ink) and hairline borders — shadows only confirm it. Always tinted with the espresso text color (`rgba(44, 36, 22, 0.04–0.14)`) so they don't read cold on cream; the canonical card shadow is `0 1px 3px rgba(44, 36, 22, 0.08)`. The one exception is the hero phone mockup, which uses a tan-tinted shadow (`rgba(201, 168, 124, 0.25)`) for a sunlit warmth. Card shadows are **almost imperceptible** — the product leans on borders for separation, not elevation.

**Animation.** Subtle, slow, mostly fades and short y-translations.
- Mount: `opacity 0→1, y +20→0`, duration `0.6–1.0s`, `delay` staggered by index.
- Card entries: spring (`stiffness: 300, damping: 30`).
- Hover lift on hero CTAs: `translateY(-2px)` — used **only on hero buttons**.
- Tap feedback on the floating meal trigger: `active:scale-95`.
- Macro bar fills: ease-out, 600ms.
- The typing animation in the hero demo is real (50ms-per-char, then an 800ms pause before the AI response card springs in).
- A single named keyframe — `kallo-pulse-dot` — gently breathes the "onboarding incomplete" indicator at 1.8s.
- Respect `prefers-reduced-motion: reduce` — drop all looping animations.

**Hover, press & selection — one recipe everywhere** (nav rows, drawer rows, chips, panel rows, destructive rows):
- **Idle**: `text-[#6E6D66]`, transparent background.
- **Hover**: `bg-kallo-hover` (the beige wash) + `text-[#141413]`. Words darken, canvas stays warm. No translate.
- **Selected**: `bg-kallo-hover` + `text-[#141413]` + `font-semibold`. Weight marks selection — **no filled umber row, no black pill, no white-on-dark state.**
- **Chips / segmented pills**: unselected = `bg-white` + `#E8E6DC` hairline + `#6E6D66` label; selected = the *entire* pill filled with `bg-kallo-hover` + `#141413` semibold. Never inner-highlight-only.
- **Buttons**: the one brown CTA darkens a step on hover (`hover:bg-kallo-btn/90`); `active:scale-95` for primary actions inside input bars; hero CTAs translate up 2px. Secondary buttons only darken their border/text.

**Transparency & blur.** The fixed marketing header uses `bg-[#FEFBF6]/80 backdrop-blur-xl` — the only place blur is used in the marketing surface. Inside the app, the hero demo's status bar and the floating "smart context" badge use the same trick. Modals/sheets, when needed, sit on `bg-white/95 backdrop-blur-md`. **Never use blur on full-screen overlays** — Kallo has no glassmorphism aesthetic.

**Layout rules.**
- The desktop sidebar is **fixed-width** (260px expanded / 68px collapsed) with a 220ms `ease-out` width transition. It sticks at `top: 0.75rem` and never reflows nav items during collapse.
- The marketing header is `position: fixed`, full-bleed, with a hairline bottom border.
- Cards never exceed 1440px content width. The hero centers at 1400px.
- On mobile, the dashboard becomes a single column; the bottom-right corner houses a 44×44 floating meal trigger.

**Imagery.** There is **no photography** in the product. The hero "phone screen" is a real mocked-up UI, not a screenshot. If you add imagery for a deck or marketing surface, treat it warmly: shot on tungsten or golden-hour daylight, grainy, never blue-cast, never high-saturation. Black and white is fine. The product itself remains photograph-free.

---

## Iconography

Kallo uses **lucide-react** end-to-end. There is no in-house icon set, no custom SVG sprite, no icon font. Every glyph in the running product — `ArrowRight`, `ArrowUp`, `Sparkles`, `Check`, `ChevronDown`, `Flame`, `LayoutDashboard`, `Activity`, `UtensilsCrossed`, `ShieldCheck`, `Settings`, `PanelLeftOpen`, `PanelLeftClose`, `Square`, `X` — is the corresponding component from `lucide-react`.

**Usage rules:**
- Default size 16 (`h-4 w-4`) for inline button glyphs.
- 20 (`h-5 w-5`) for nav rail items.
- 14 (`h-3.5 w-3.5`) for the sparkle inside the hero "AI badge".
- Stroke weight is Lucide default (1.5–2 px); never thickened.
- Color is always inherited from `currentColor`. Inside accent-tinted contexts (e.g. the sparkle in the dark pill), set color explicitly to `var(--kallo-accent)`.
- Icons never replace text labels on primary buttons — they sit *beside* the label with an 8px gap.
- The only "decorative" icon usage is the sparkle (`Sparkles`) in the AI-badge pattern and the `UtensilsCrossed` glyph as a logo-adjacent product mark.

For this design system, lucide is loaded from CDN: `https://unpkg.com/lucide@latest`. Inside any HTML demo you can drop a `<i data-lucide="utensils-crossed"></i>` and call `lucide.createIcons()`.

**Emoji.** Never. Not in copy, not in buttons, not in toasts, not in empty states.

**Unicode glyphs.** A few utility characters do appear in copy: `·` (middle dot, U+00B7) as the separator in trust lines, `–` (en dash, U+2013) in date ranges, `…` (horizontal ellipsis, U+2026) in loading strings. `&ldquo; &rdquo;` curly quotes for the user's meal text. Never straight quotes, never `...` typed as three dots.

**Logo.** Kallo has no graphical logo — the brand mark is the **wordmark** "Kallo" typeset in Lora regular at 24–28px, color `#2c2416`. A monochrome SVG version lives in `assets/logo-wordmark.svg`. When you need a square avatar (favicon, app icon, social), use `assets/mark-nh.svg` — a Lora "Nh" ligature centered on a tan circle. Both are reproductions; the real product currently ships the default `next/favicon.ico` placeholder.

---

## Index

```
.
├── README.md                   ← this file
├── SKILL.md                    ← agent-skill manifest (for Claude Code / SKILLS)
├── colors_and_type.css         ← CSS custom properties for color + type
├── assets/
│   ├── logo-wordmark.svg       ← "Kallo" wordmark in Lora
│   ├── logo-wordmark-dark.svg  ← cream-on-espresso variant
│   ├── mark-nh.svg             ← square "Nh" mark on tan
│   └── favicon.svg
├── preview/
│   ├── 01-colors-brand.html        ← brand palette swatches
│   ├── 02-colors-macros.html       ← macro nutrient swatches
│   ├── 03-colors-status.html       ← success / danger
│   ├── 04-colors-heatmap.html      ← adherence heatmap scale
│   ├── 05-type-display.html        ← Lora display specimen
│   ├── 06-type-body.html           ← DM Sans body specimen
│   ├── 07-type-scale.html          ← full type scale
│   ├── 08-type-eyebrow.html        ← uppercase eyebrow + meal-quote treatment
│   ├── 09-radii.html               ← corner radii sample
│   ├── 10-shadows.html             ← shadow / elevation
│   ├── 11-spacing.html             ← 4-px spacing scale
│   ├── 12-buttons.html             ← all 7 button variants
│   ├── 13-inputs.html              ← meal input bar + suggestion chips
│   ├── 14-cards.html               ← persisted meal card
│   ├── 15-nav.html                 ← sidebar nav row states
│   ├── 16-icons.html               ← lucide usage
│   └── 17-brand-logo.html          ← wordmark + mark
└── ui_kits/
    └── kallo_app/
        ├── README.md
        ├── index.html              ← click-thru: landing → app → logging → dashboard
        ├── Landing.jsx
        ├── AppShell.jsx
        ├── Sidebar.jsx
        ├── LoggingScreen.jsx
        ├── DashboardScreen.jsx
        ├── MealInput.jsx
        ├── MealCard.jsx
        ├── TodayDock.jsx
        └── tokens.js
```

---

---

## Canonical surfaces

When in doubt, **mimic these specific files from the source repo** — they are the parts of the product the designer hand-built and is happy with. New work should pattern-match against them, not generalize from "this is a Tailwind dashboard".

| Surface | Source file | Why it's canonical |
|---|---|---|
| **Landing** | `components/landing-page/{header,hero,cta-section,footer}.tsx` | The hero's Lora-italic-tan headline split, the cream-blob ambient backgrounds, the AI-badge pill pattern, the phone-in-CSS demo, the "no photography" discipline. |
| **Sidebar** | `components/app/desktop-sidebar.tsx` | Width animates only on `width`, not children. 220ms ease-out. Hairline border + faint shadow + warm umber active state (NOT black, NOT accent). Section labels are 10px medium, 0.06em tracked. |
| **Onboarding** | `components/onboarding/wizard-shell.tsx` + `onboarding-card.tsx` | The `rounded-[28px]` modal on `bg-[#2C2416]/20 backdrop-blur-sm` overlay. Footer pinned with skip+next, `bg-[#2C2416]` dark CTA (NOT umber, this is the one place the espresso-as-CTA shows up). Step indicator at the top, gradient scroll fade at the bottom. |
| **Logging feed** | `components/logging/feed/{persisted-meal-card,feed-area,empty-state}.tsx` + `input/meal-input.tsx` | The 40px-deep left indent for the timeline. The `top:2 -left-[43px]` dot + `-left-10 w-px` rail. Curly-quoted meal text in Lora 17. Empty state's three-suggestion-chip pattern. The meal-input bar's focus-within tan-tinted shadow. |
| **Adherence heatmap** | `components/dashboard/progress/adherence-heatmap.tsx` + `heatmap-colors.ts` | The 5-step diverging warm scale, the ResizeObserver-driven cell sizing, the `font-mono` "85% on track" stat, the gradient-bar legend at the bottom, the staggered fade-in (0.16s with reduced-motion fallback). |
| **Circle feed** | `components/groups/{feed-entry,thread-feed,share-replies}.tsx` | Threads-anatomy posts, newest-first: 36px `ProfileAvatar` (Google picture, letter-on-`#E8E6DC`-disc fallback) · bold 15px name + 15px muted relative time · 15px content · 11px `P: 26g` macros with bold 13px kcal · quiet 11.5px icon action row. Replies reuse the exact meal anatomy minus numbers/actions. Hairline day separators, hidden scrollbars. |
| **Invite dialog** | `components/groups/add-friend-dialog.tsx` + `invite/*` | `bg-kallo-surface` panel, `#E8E6DC` border, serif title. Tab track `bg-[#E8E6DC]/60` with the active tab as a white pill (`shadow-sm` + hairline ring). In-place editing (pencil → inline input, bottom hairline darkens on focus, inline Save). Copy buttons get a 2s check + "Copied" success state. |
| **Empty states** | `components/ui/empty-state.tsx` | Every empty surface composes this: icon on an `#E8E6DC` disc, `#141413` title, `#6E6D66` supporting line, at most one brown CTA. No bare one-line empties. |
| **Side panes** | `components/groups/info/*` | Reuses the left sidebar's card chrome (`rounded-xl border-kallo-border/60 bg-white`, 12px shell gutter) and its collapse-to-strip behavior. Messenger-style sections: 13px semibold headings with flipping chevrons; destructive rows styled as plain nav rows — danger ink only inside the confirm dialog. |

---

## Drift watchlist — what you'll see in the codebase but should NOT copy

These patterns crept into `components/nutrition/*` and parts of `components/dashboard/progress/*` when sessions were derived from screenshots instead of from the canonical surfaces above. **They are anti-patterns in this brand. Don't propagate them.**

### 1. Generic shadcn `destructive` instead of `--kallo-danger`

❌ `bg-destructive/10 text-destructive` (renders cold red `oklch(0.577 0.245 27.325)`)
✅ `bg-kallo-danger/10 text-kallo-danger` (terracotta `#d37b69`)

Search and destroy. The `destructive` token is the shadcn default and breaks the warm palette on sight.

**The italic-accent color also carries semantic meaning.** The signature pattern — Lora italic light on the second clause of a sentence — is **tan `#c9a87c` for highlight / poetry / decoration**, **terracotta `#d37b69` for attention / concern / off-pace**. Pick the right one:

- *"Track Vietnamese meals **without the guesswork**"* — tan, highlight
- *"**Needs attention.** The trend is softer than the plan right now."* — terracotta, concern
- *"**A quiet stretch.** Keep logging to sharpen the pattern."* — tan, gentle highlight
- *"**Far off target** on protein this week."* — terracotta, concern

### 2. Tiny-dot disease

The `h-1.5 w-1.5 rounded-full bg-kallo-accent` "leading dot" pattern is fine **once per section, as a status indicator**. It is NOT fine as decoration in front of every row label. Nutrient rows, the verdict hero, the composition legend, and the macro pattern all use it simultaneously — that's four dots before three pieces of text. Result: dot fatigue.

**Rule**: a tiny dot earns its place only when it encodes status. If every dot is the same color (`bg-kallo-accent`) and conveys no information, delete it.

### 3. Trend-arrow icons

`TrendingUp` / `TrendingDown` / `ChevronRight` are SaaS-dashboard tropes. The Kallo voice is conversational, not analytical. Weight progress should be written, not arrowed:

❌ `<TrendingDown /> -1.2 kg`
✅ Lora italic accent: *"down 1.2 kg this month"* — or just the number, no icon

The icon allowance for this product is: `ArrowRight` (CTAs), `ArrowUp` (meal submit), `Sparkles` (AI badge), `Flame` (the calorie ring, exactly once), `Check` (feature lists), `ChevronDown` (collapsible meal cards). Nav rail items have their own lucide glyphs and that's where the inventory ends.

### 4. Pill + icon combos with destructive coloring

The `<span class="bg-destructive/10 text-destructive"><TrendingDown />Behind</span>` pattern in `progress-story.tsx` is the worst offender — it lights up red on a warm cream background, screams "you failed", and uses an icon to do it. The Kallo voice for the same situation is the dashboard's own copy: *"The trend is softer than the plan right now."* — Lora italic, no pill, no icon, no color.

### 5. Card opacity gymnastics

`bg-card/55`, `bg-card/80`, `bg-kallo-surface/70` are AI-generated, not designed. Real cards are solid `bg-white` (`#fff`) or solid `bg-kallo-surface` (`#fefbf6`). Hierarchy comes from **borders**, not alpha layering.

### 6. Eyebrow inflation

Nutrition has *six* eyebrows in one scroll — `Pattern analysis`, `Period rhythm`, `Where to focus`, `What's holding steady`, `In the background`, `An editor's note`. That's not editorial structure, that's six labels in a row.

**Rule**: one eyebrow per *screen section*, max two on the whole screen. If the content reads as continuous prose (which nutrition aspires to — "an editor's note"), drop the eyebrows entirely and let the Lora italic accent do the lifting.

### 7. Macro shorthand inconsistency

The logging timeline writes `P: 38g  C: 72g  F: 14g` — letter, colon, space, value, unit. The nutrition rhythm writes `P 22%` — letter, space, value. These are different things; if you mean grams say grams, if you mean target percentage say "% of target". Don't compress to ambiguity.

### 8. Type-size and radius zoo on one card

`progress-story.tsx` packs `text-[9px]`, `text-[11px]`, `text-xs`, `text-sm`, `font-mono text-xs`, `text-3xl` AND `rounded-xl`, `rounded-[1.25rem]`, `rounded-[1.5rem]`, `rounded-full` into a single component. Pick **one type scale per card** (e.g. 11/13/24 + mono caption) and **one radius family** (e.g. inside 1.5rem outer = 1.25rem inner; nothing else).

---

## Dashboard discipline (hardened 2026-07)

The web dashboard (`components/dashboard/*`) is locked to these rules. They exist as tokens, not conventions — reach for the token, don't invent a value.

**Type — exactly three sizes.** `text-hero` (44px stat numbers; the `--text-hero` theme token in `app/globals.css` carries weight 500, line-height 1, −0.04em tracking), `text-sm` (14px body: meal names, inputs, empty states), `text-xs` (12px labels + meta: eyebrows, section headers, chart ticks, heatmap labels, legend, tooltips). No `text-lg`, no bracket sizes, no fourth step. Both stat heroes (calories remaining, current weight) are `text-hero` — never differently sized.

**Ink — three colors.** Primary ink `#141413` (`--kallo-ink`) for numbers and primary copy, muted ink `#6E6D66` (`--kallo-ink-muted`) for everything secondary, tan `--kallo-accent` as the single highlight (flame, chart line, focus rings). White appears only on the umber `--kallo-btn` CTA — one per surface; terracotta `--kallo-danger` only on live validation errors and confirm dialogs. Data-viz pigments (heatmap diverging scale, macro-bar gold/taupe/stone) are chart ink, not text ink — don't promote them.

**Card chrome — one recipe.** `rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm` (the sidebar's crisp language) plus the shared hover: `transition-[border-color,box-shadow] duration-200 hover:border-kallo-accent/50 hover:shadow-md hover:shadow-kallo-text/[0.06]`. Inner elements are `rounded-xl`. No borderless floating-blob cards, no `rounded-[1.375rem]`, no 32px-blur shadows.

**Section headers — one spec.** `font-medium text-xs uppercase tracking-[0.08em] text-kallo-text-muted` on the left, a plain `text-xs` context label on the right (range, "Today"). Headers live outside the card.

---

## Designing a new feature — the extrapolation rules

When you add a feature that doesn't exist yet (Workouts, Sleep, Mood, Reminders, anything), don't generalize from "this is a Tailwind dashboard". And don't just rename meal-logging components either. **Find the feature's own mental model first, then borrow tokens to dress it.**

1. **What's the unit?** Meals are *entries* (many small ones streamed through a day). Workouts are *sessions* (one concentrated event per day). Sleep is *nights*. Mood is *moments*. Each unit suggests a different IA: feed vs. canvas vs. calendar vs. timeline. Pick the right metaphor before picking components.

2. **What can it share vs. what must be its own?** The design system is *tokens + voice + iconography rules*, not a UI kit you bolt together. Workouts shares the colors, the type system, the icon allowance, the Lora-italic-accent verdict pattern, the warm shadows, the radii family. Workouts does NOT have to share the timeline-dot-+-rail pattern, the persisted-card shape, or the left sidebar. If two features look interchangeable, users will confuse them. **Different rooms, same house.**

3. **Pick the right scale of reuse.**
   - **Token-level** (always reuse): `--kallo-*` colors, the type families, radii, shadows, the icon allowance, the eight Hard Rules.
   - **Pattern-level** (reuse when applicable): trust-line separator (` · `), Lora-italic verdict, eyebrow-when-needed, bounded numbers, hairline borders over shadows.
   - **Component-level** (avoid blind reuse): the meal-input box, the timeline rail, the persisted-meal-card. These are *meal-shaped*. If your feature isn't a meal, build the equivalent component fresh in the same tokens.

4. **Borrow analogies, not implementations.** A "Today's session" dashboard widget should *recall* TodayDock (eyebrow + big tabular figure + one accent ring + a short subline) without being its sibling component. A weekly volume view should *recall* AdherenceHeatmap (5-step warm scale, ResizeObserver sizing, mono "85% on track" stat) without literally importing it.

5. **Apply the icon allowance.** Pick one Lucide glyph for the feature in the nav rail (Workouts → `dumbbell`; Sleep → `moon`; Reminders → `bell`). Inside the feature, the icon allowance is the same eight: `ArrowRight`, `ArrowUp`, `Sparkles`, `Flame`, `Check`, `ChevronDown`, plus the two nav glyphs. **No trend arrows. No medals. No fire emojis.**

6. **Apply the color allowance.** Status: sage and terracotta, that's it. Accents/decoration: tan, taupe, stone. If a feature needs to distinguish more than three categories (muscle groups, food types, mood states), **stop using color** — go to neutral chips with a Lora monogram in a tinted disc (see card 24 / 26 for the muscle-group treatment).

7. **Write the empty state and verdict in the canonical voice.** Lora question + DM Sans subline + three localized suggestion chips for the empty state. Lora-italic accent (tan for highlight, terracotta for attention) for the verdict — one per screen, not six.

8. **Bound your numbers.** Estimated values get a range (`est. 1RM 88–94 kg`). Real measurements get the right precision (`68.5 kg`, `12 reps`, `1h 12m`). Robot dates get rewritten to human form (see card 22).

**Worked example: Workouts.** Cards 23–26 walk it through.
- **Card 25** is the venture — a full page mocked up as a *session canvas* on the stone (`--kallo-track`) background instead of cream, with a thin week-strip at the top and exercise blocks anchored by a small line-art sketch. Different mental model from meal logging, different "room" within the same house. Sets are rendered in a clean four-column grid (**Set / Weight / Reps / RPE**) with the unit pinned to the right of each cell — `kg`, `reps`, `/10`.
- **Card 26** shows the chosen composer: a Cmd-K search palette where each exercise row carries a **line-art sketch in umber stroke** (no photography — that's the brand rule) plus the monogram-tinted muscle chip on the right. The post-selection state shows the empty exercise block with the same four-column grid in input mode.
- **Cards 23 and 24** show entry-level DO/DON'Ts: monogram-tinted muscle chips instead of neon body-chart, quiet Lora observation instead of fire-emoji streaks, one tan ring instead of three Apple-Watch rings, bounded 1RM ranges instead of fake-precise decimals.

**New patterns this added to the design system:**
- **Line-art exercise sketches** — single-stroke (1.5–2px) umber-on-tan-tinted-disc, ~32–44px size, notebook drawing aesthetic. Use this shape for any "things-that-need-a-picture" beyond the icon allowance (exercises now, future possibilities: food categories, recipe steps, body parts).
- **The 4-column set/value/value/value grid** — column headers in 9px uppercase eyebrow style, mono numerals in cells, units (`kg`, `reps`, `/10`) pinned to the right of each value as small DM Sans stone-gray. Works in both view and input mode.
- **Monogram-in-tinted-disc chips** — a 18–28px Lora-monogram disc on a tinted background, for categorizing things beyond the three-color limit (muscle groups, ingredient types, anything taxonomic).

The same recipe extends to any new feature. If you're not sure where to start, mock up one screen in the *wrong* way (the way a generic fitness/sleep/mood app would do it), then translate it surface-by-surface back into Kallo voice using the rules above.

---

## Caveats & open questions

- **No real logo file ships in the repo.** The wordmark and "Nh" mark in `assets/` are reproductions typeset in Lora. If you have an official mark, drop it in.
- **Fonts are loaded from Google Fonts** (Lora + Be Vietnam Pro, both exact matches to the production `next/font` setup; DM Sans is kept in the import only for older mocks that still reference it). The repo also uses `Geist Mono` via `next/font` for utility text — not used in the visible UI we recreated. If you specifically need Geist, please confirm.
- **Photography direction is undocumented in the source repo** — the product has no images. The guidance above is inferred from the warm palette and is offered as a starting point, not a rule.
- **Dark mode tokens are real** (the repo defines a full `.dark` block) but the running product appears to ship light-mode only. The dark palette in `colors_and_type.css` is preserved verbatim; treat it as untested.
