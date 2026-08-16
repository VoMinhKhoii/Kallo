---
name: kallo-design
description: Use this skill to generate well-branded interfaces and assets for Kallo — the AI-powered Vietnamese meal tracker — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors (warm earthy palette anchored on a cream surface and a tan accent), type (Lora serif + Be Vietnam Pro sans), fonts, assets (logo + app mark + favicon), Lucide iconography conventions, and a click-through React UI kit recreating the Landing / Dashboard / Logging surfaces of the product. Covers two platforms — web (Next.js, Be Vietnam Pro + Lora, --kallo-* tokens) and the mobile Flutter app (Be Vietnam Pro, a calmer Threads-tuned type scale; see mobile.md) — routed by platform so you only load what you need.
user-invocable: true
---

# Kallo Design Skill

Kallo (read: "n-yum"; colloquially Vietnamese for "to estimate roughly in your head") is an AI-powered Vietnamese meal tracker. Users describe meals in natural language — `2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh chua` — and the app decomposes them into Vietnamese ingredients, looks up real food-composition data, and returns a bounded calorie/macro estimate. Visual direction is **Apple Notes on cream paper**: warm, beigy, restrained, more typography than chrome. Less is more.

## Platforms — pick your surface first

This skill covers two surfaces that share the **brand** (warm palette, logo,
Vietnamese-diacritic rule, no-emoji, Lucide icons) but **diverge in type, tokens
and layout**. Read only the doc for the surface you're building — not both.

- **Web** (Next.js / React — marketing + app): the sections below, plus
  `README.md`, `colors_and_type.css`, `preview/`, `ui_kits/nham_app/`. Type is
  **Be Vietnam Pro + Lora** (Be Vietnam Pro replaced DM Sans as the primary UI
  sans web-wide — full Vietnamese diacritics; DM Sans remains only as a legacy
  fallback); tokens are `--kallo-*` CSS custom properties. Everything in
  the rest of this file and in `README.md` is the **web** system.
- **Mobile** (Flutter app, `apps/mobile-flutter`): read **`mobile.md`**. It is a
  *different, calmer* system — **Be Vietnam Pro** sans (Vietnamese-safe), a
  compact Threads / Apple-Health–tuned scale, **two** text colours, one 12px
  rhythm. Do **not** apply the web type scale or `--kallo-*` tokens to Flutter.

## How to use this skill (web)

1. **Read `README.md`** first — it has the full Content Fundamentals, Visual Foundations, and Iconography rules. It is the source of truth.
2. **Pull tokens from `colors_and_type.css`** — every color, type family, radius, shadow, and spacing variable lives there as a CSS custom property. Import it directly rather than re-deriving the palette.
3. **Inspect the preview cards in `preview/`** — 17 cards covering color, type, spacing, components and brand. Each is a self-contained HTML snippet you can crib from.
4. **Steal from the UI kit at `ui_kits/nham_app/`** — JSX recreations of the Landing page, App Shell, Sidebar, MealInput, MealCard, TodayDock, Heatmap, WeightChart, and three screen-level compositions. The kit boots from `index.html` with no build step.
5. **Use real assets** — `assets/logo-wordmark.svg`, `assets/mark-nh.svg`, `assets/favicon.svg`. Do not redraw the wordmark.

## When the user asks you to build something

If they want a **visual artifact** (slide, mock, throwaway prototype, marketing surface): copy the assets you need out of this skill folder into the working project, link `colors_and_type.css`, follow the type and color rules from README.md, and produce a single self-contained HTML file the user can view. Prefer Lora for any text above 18px; prefer Be Vietnam Pro for everything else.

If they're working on **production Next.js code** for the actual Kallo app: read the originals at https://github.com/VoMinhKhoii/Nham — this skill is a reference, not a replacement. The repo's `app/globals.css` and `components/ui/button.tsx` define the canonical `--kallo-*` tokens and `buttonVariants` table. The foundations are first-class Tailwind tokens there, with metrics calibrated to **Anthropic's design system** (type ramp 64/48/36/28/22, body leading 1.55, radii on the 4/6/8/12/16 scale, minimal espresso-tinted shadows, 40px touch targets) but expressed entirely in the Kallo palette and faces: a named type ramp (`text-display`, `text-h1`–`text-h4`, `text-caption`, `text-2xs`, `text-eyebrow` — each carrying its line-height/tracking/weight), `eyebrow` and `italic-accent` utilities, semantic spacing (`p-card`, `p-card-sm`, `p-card-lg`, `gap-section`, `py-band`), a warm shadow scale replacing Tailwind's black defaults, and shadcn semantic tokens (`primary`, `destructive`, `ring`, `border`, …) re-pointed at the warm palette so stock components are on-brand at the source. The live specimen page is `/design-system` in the running app (unlisted, noindexed).

If the user invokes this skill **with no other guidance**: ask them what they want to build (deck? marketing page? prototype? new app screen?), get a couple specifics (audience, surface, length), then act as an expert designer who outputs HTML artifacts *or* production code, depending on the need.

## Canonical surfaces — mimic these specifically

When in doubt, pattern-match against these specific files (read them via the GitHub link above). They are the hand-designed surfaces. New work should look like them, not like "a Tailwind dashboard".

- `components/landing-page/{header,hero,cta-section,footer}.tsx` — the landing page
- `components/app/desktop-sidebar.tsx` — the rail
- `components/onboarding/wizard-shell.tsx` + `onboarding-card.tsx` — the onboarding modal pattern
- `components/logging/feed/{persisted-meal-card,feed-area,empty-state}.tsx` + `input/meal-input.tsx` — the full logging surface
- `components/dashboard/progress/adherence-heatmap.tsx` + `heatmap-colors.ts` — the consistency map

Skim `README.md → Canonical surfaces` for what each one teaches.

## Drift watchlist — what NOT to copy

The README has a full **Drift watchlist** section calling out 8 anti-patterns that crept into `components/nutrition/*` and parts of `components/dashboard/progress/*` from session-to-session drift. Read it before generating any dashboard or analytics view. The high-frequency offenders:

1. **`destructive` token** instead of `--kallo-danger` — `destructive` renders cold red, breaks the warm palette on sight. Always `bg-kallo-danger/10 text-kallo-danger`.
2. **Tiny-dot disease** — `h-1.5 w-1.5 rounded-full bg-kallo-accent` as decoration before every label. Dots earn their place only when they encode status.
3. **Trend-arrow icons** — `TrendingUp` / `TrendingDown` are SaaS tropes. Write the trend in Lora italic instead.
4. **Pill + icon + destructive coloring** combos for negative states — replace with Lora-italic prose copy.
5. **`bg-card/55` opacity tricks** — use solid `bg-white` or `bg-kallo-surface`; hierarchy comes from borders, not alpha.
6. **Eyebrow inflation** — one eyebrow per section, max two per screen. Long-form pages drop them entirely.
7. **Macro shorthand `P 22%`** — write `P: 38g` (with unit) or "22% of protein target" (with the word). Never letter+number alone.
8. **Type/radius zoo** — one type scale per card, one radius family per card. If you find yourself writing four different `rounded-[…]` values inside one component, stop.

## Hard rules

- **Sentence case** for every button, link and heading. UPPERCASE only for 10px eyebrow labels.
- **No emoji.** Anywhere. Use Lucide icons instead.
- **Icon allowance is small**: `ArrowRight`, `ArrowUp`, `Sparkles`, `Flame` (once, the calorie ring), `Check`, `ChevronDown`, and the four nav-rail icons. Anything else needs to justify itself.
- **No pure red, no pure green, no purple gradients.** Status colors are sage `#7ca368` and terracotta `#d37b69`.
- **Lora is never bold** — 400 normal or 300 italic light. The signature treatment is the second clause of a headline in italic 300 at `--kallo-accent` (`#c9a87c`).
- **No photography in the product.** Marketing imagery, if used, must be warm-toned (tungsten/golden hour), grainy, never blue-cast.
- **Preserve Vietnamese diacritics** in dish names — never anglicize `phở`, `bún chả`, `mực kho`.
- **Bounded estimates, never fake precision.** When generating sample data, write ranges (`760–845 kcal`) and confidence labels, not single-decimal numbers.
- **Ink is the neutral pair** — primary `#141413`, muted `#6E6D66` (never lighter), hairlines `#E8E6DC` — and **brown (`--kallo-btn`) fires on exactly one primary CTA per surface**; selected/hover states are the beige `--kallo-hover` wash + black text (+ semibold when selected), never a filled umber or black pill. See README → "Visual foundations" (Color / Hover, press & selection).

## Files

```
README.md                ← Full brand guide. Read first.
colors_and_type.css      ← All design tokens, ready to import.
SKILL.md                 ← This file.
assets/                  ← Logo wordmark, app mark, favicon.
preview/                 ← 17 design-system specimen cards.
ui_kits/nham_app/        ← JSX UI kit + click-through index.html.
```
