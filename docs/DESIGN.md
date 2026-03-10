# Nhẩm Design System v1.0
> Design system for Nhẩm — `nham-cal-track.vercel.app` · March 2026

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Radius](#4-spacing--radius)
5. [Shadows](#5-shadows)
6. [Layout & Structure](#6-layout--structure)
7. [Components](#7-components)
   - [Input Bar](#71-input-bar)
   - [User Message Bubble](#72-user-message-bubble)
   - [Analysis Card](#73-analysis-card)
   - [Sidebar Navigation](#74-sidebar-navigation)
   - [Buttons](#75-buttons)
   - [Suggestion Chips](#76-suggestion-chips)
   - [Loading State](#77-loading-state)
8. [Motion Language](#8-motion-language)
9. [Voice & Copy Patterns](#9-voice--copy-patterns)
10. [Token Reference](#10-token-reference)

---

## 1. Design Principles

These five principles govern every visual and interaction decision. When a component decision is unclear, come back here.

### 01 · Warm Paper
The UI feels like a physical journal on a wooden desk — not a clinical dashboard. The canvas is a barely-there warm cream (`#FEFBF6`), not pure white. Cards float on top of it in pure white. The contrast is quiet and material.

> **In practice:** Never use stark white (`#FFFFFF`) as a background. Card headers step down to `#F5EFE5`. Every background layer is slightly warmer than the one above it.

### 02 · Frictionless Entry
The most important interaction in the app is typing a meal and submitting. Every pixel decision around the input bar optimises for speed and invitation. The input is always reachable, always large, always soft.

> **In practice:** The input sits pinned at the bottom of the content pane. No required fields, no modals, no steps before you can type. One tap, one text, one send.

### 03 · Data Has Weight
Nutritional output should feel deliberate and legible, not chatty. The Analysis Card uses a structured table — not prose, not pills — because the data deserves a format that signals precision. Color-coding macros (blue/amber/rose) creates instant scanability without decoration.

> **In practice:** Numbers are always right-aligned, `tabular-nums`, and a touch bolder than labels. The macro column headers (PRO / CARB / FAT) are the only place pure color is used in the data layer.

### 04 · Brown is the New Black
The palette replaces cold grays entirely. Primary text is deep warm brown (`#2C2416`). Secondary text is a muted tan-brown (`#8B7355`). Borders are warm tan (`#D4C4A8`). The result feels personal and handcrafted, not engineered.

> **In practice:** Never use gray for text or borders. If you reach for `#666` or `#ccc`, ask yourself what the warm-brown equivalent is.

### 05 · Honest Uncertainty
The app never pretends to know things it doesn't. This principle lives in copy ("~" prefix, no false precision) but also in layout — the Analysis Card shows per-ingredient rows rather than a single magic number, making the methodology visible.

> **In practice:** Never show a calorie number without its source rows visible or collapsible. Totals are bold; the AI's work is always one level below, available to inspect.

---

## 2. Color System

All values derived from Tailwind classes and computed styles.

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `bg-canvas` | `#FEFBF6` | Page background — whole-app base |
| `bg-surface` | `#FFFFFF` | Cards, analysis card body |
| `bg-card-header` | `#F5EFE5` | Analysis card header stripe |
| `bg-hover` | `#F0EAE0` | Hover state on nav items, chips |
| `bg-user-bubble` | `rgba(201,168,124,0.15)` | User message background |
| `bg-loading` | `#FFFFFF` with border | Analyzing… bubble |

### Text

| Token | Value | Role |
|-------|-------|------|
| `text-primary` | `#2C2416` | Headings, strong body, numbers |
| `text-secondary` | `#8B7355` | Labels, sub-items, metadata |
| `text-tan` | `#C9A87C` | Active nav icons, accent text |
| `text-inverse` | `#FFFFFF` | On dark buttons |
| `text-muted` | Tailwind `muted-foreground` | Inactive nav labels |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `border-card` | `#D4C4A8` | Analysis card outer border |
| `border-tan` | `rgba(232,213,181,0.5)` | Card header bottom border |
| `border-row` | `rgba(240,234,224,0.4)` | Row dividers inside card |
| `border-input` | `rgba(232,213,181,0.4)` | Input bar border default |
| `border-bubble` | `rgba(201,168,124,0.20)` | User message bubble border |

### Macro Colors (data only — never used in UI chrome)

| Macro | Header | Values |
|-------|--------|--------|
| Protein | `text-blue-500` | `text-blue-600` |
| Carbs | `text-amber-500` | `text-amber-600` |
| Fat | `text-rose-400` | `text-rose-500` |
| Calories | `text-[#2C2416]` bold | `text-[#2C2416]` semibold |

### Interactive

| Token | Value | Usage |
|-------|-------|-------|
| `btn-primary` | `#695E4E` | Primary buttons, submit |
| `btn-primary-hover` | `#5A5043` | Button hover |
| `nav-active-bg` | `#695E4E` | Active sidebar nav item |
| `nav-active-text` | `#FFFFFF` | Active sidebar nav label |
| `day-active-bg` | `rgba(201,168,124,0.30)` | Active day in timeline |

---

## 3. Typography

### Typefaces

**Lora** (Google Fonts, serif) — Used exclusively for the hero prompt heading on the empty logging state. Gives warmth and humanity to the invitation to log.

**DM Sans** (Google Fonts, sans-serif) — Used for everything else: nav labels, card titles, table data, buttons, input text, metadata. Applied via inline `style="font-family: 'DM Sans', sans-serif;"` on key components.

**System UI fallback** — `ui-sans-serif, system-ui, sans-serif` — Tailwind default for all other elements.

### Type Scale

| Role | Size | Weight | Other |
|------|------|--------|-------|
| Hero heading ("What are you having today?") | `text-4xl` / ~2.25rem | Regular | Lora serif, muted color |
| Card title (analysis card header) | `text-[11px]` | 600 semibold | DM Sans, uppercase, `tracking-wider` |
| Column headers (ITEM / CAL / PRO…) | `text-[9px]` | 600 semibold | DM Sans, uppercase, `tracking-wider`, muted |
| Ingredient name | `text-[13px]` | 500 medium | DM Sans, `#2C2416` |
| Ingredient portion | `text-[10px]` | 400 regular | DM Sans, `#8B7355` |
| Macro values in rows | `text-xs` (12px) | 500 medium | DM Sans, `tabular-nums`, colored per macro |
| Total row | `text-xs` | 600 semibold | DM Sans, `tabular-nums` |
| Nav labels | `text-sm` | 500 medium | `tracking-tight` |
| Timeline date | `text-xs` | 500 medium | `tracking-tight`, `text-foreground` |
| Section labels (MAIN, SETTINGS) | `text-[10px]` | 500 medium | uppercase, `tracking-[0.04em]`, muted |
| Button text | `text-xs` | 500 medium | DM Sans |
| Input placeholder | `text-sm` | 400 | muted color |
| Timestamp | `text-xs` | 400 | muted, right-aligned |

---

## 4. Spacing & Radius

### Spacing (Tailwind base-4 scale)

| Token | Value | Common usage |
|-------|-------|--------------|
| `gap-1` / `p-1` | 4px | Tight icon-label gaps |
| `gap-2` / `p-2` | 8px | Chip padding, inline gaps |
| `p-3` | 12px | Input bar inner padding |
| `p-4` | 16px | Card header padding, table row padding |
| `p-3 py-2.5` | 10px vertical | Table data rows |
| `gap-3` | 12px | Sidebar nav item gap |
| `gap-6` | 24px | Sidebar section gap |
| `py-6` | 24px | Chat area top/bottom padding |
| `px-0` | 0 | Chat container horizontal (full width) |
| `gap-4` | 16px | Between chat messages |

### Border Radius

| Token | Value | Used on |
|-------|-------|---------|
| `rounded-xl` | 12px | Input bar, confirm/cancel buttons |
| `rounded-2xl` | 16px | Analysis card, chat bubbles |
| `rounded-bl-sm` / `rounded-br-sm` | 4px override | Chat bubble "tail" — AI card bottom-left, user bubble bottom-right |
| `rounded-full` | 9999px | Edit button, suggestion chips, submit button |
| `rounded-lg` | 8px | Submit icon button, nav active pill |
| `rounded-md` | 6px | Sidebar icon containers |
| `rounded-full` (icon) | 50% | AI icon badge (sparkles) in card header |

---

## 5. Shadows

| Token | Value | Used on |
|-------|-------|---------|
| Card shadow | `0 2px 16px rgba(0,0,0,0.08)` | Analysis card |
| Card hover | `0 4px 20px rgba(201,168,124,0.08)` | Input bar focus state |
| Button shadow | `shadow-sm` | Confirm button, icon button |
| Sidebar shadow | `shadow-[#695e4e]/20 shadow-sm` | Active nav item |
| Icon badge shadow | `shadow-sm` | Sparkles icon in card header |

**Rule:** Shadows use near-black (`rgba(0,0,0,…)`) for structural depth and warm tan (`rgba(201,168,124,…)`) for glow effects on hover/focus. Never cold gray shadows.

---

## 6. Layout & Structure

### App Shell

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (collapsible)   │  Timeline Nav   │  Chat Content   │
│  · Nav links (MAIN)      │  · Month/Year   │  · Messages     │
│  · Nav links (SETTINGS)  │  · Week groups  │  · Input bar    │
│  · User profile          │  · Day entries  │                 │
└─────────────────────────────────────────────────────────────┘
```

- **Sidebar width:** `w-[…]` fixed, collapsible via toggle. Active link: `bg-[#695e4e] text-white rounded-lg`.
- **Timeline nav:** Fixed-width column (`w-[212px]`), border-right, scrollable, `py-3 pr-3`. Hierarchical: Month → Week → Day.
- **Chat content:** `flex-1`, `overflow-hidden`, `flex flex-col`. Messages scroll in `flex-1 overflow-y-auto px-0 py-6`. Input bar pinned at bottom.
- **Message container:** `mx-auto w-full max-w-3xl flex flex-col gap-4`. Max width constrains the chat column to readable width.

### Timeline Hierarchy

```
1/2026  ▾          ← collapsed month
2/2026  ▲          ← expanded month
  Week 1
  Week 2
  Week 3
  Week 4 ▲         ← expanded week
    Mon – 16/2
    Tue – 17/2
    Wed – 18/2 ●   ← active day (highlighted)
```

Active day: `bg-[#C9A87C]/30`, with a left bracket connector (`border-[#C9A87C] border-b-2 border-l-2 rounded-bl-lg`).

---

## 7. Components

### 7.1 Input Bar

The most important interaction surface. Always pinned at the bottom of the chat pane.

**Structure:**
```
┌──────────────────────────────────────────────────┐
│  [textarea: "Describe your meal..."]  [→ button] │
└──────────────────────────────────────────────────┘
```

**Classes (extracted):**
```
Container: flex items-center gap-3 rounded-2xl border border-[#E8D5B5]/40 bg-white p-3
           shadow-[0_4px_20px_rgba(201,168,124,0.08)] transition-shadow duration-300
           focus-within:border-[#C9A87C]/40 focus-within:shadow-[0_4px_20px_rgba(201,168,124,0.15)]

Textarea:  flex-1 resize-none bg-transparent text-sm text-[#2C2416]
           placeholder:text-muted-foreground outline-none

Submit btn: flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
            bg-[#695e4e] text-white shadow-sm transition-all duration-200
            hover:bg-[#5a5043] hover:shadow-md active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed
```

**Behavior:**
- Submit button is `disabled` until textarea has content.
- On focus: container border lightens to `#C9A87C` at 40%, shadow warms and lifts.
- On submit: textarea clears, user bubble appears top-right, loading bubble appears bottom-left.

---

### 7.2 User Message Bubble

Appears right-aligned after submit. The user's own words, visually distinct from AI output.

**Classes:**
```
Outer wrapper: flex justify-end

Bubble: max-w-[80%]
        rounded-2xl rounded-br-sm          ← "tail" on bottom-right
        border border-[#C9A87C]/20
        bg-[#C9A87C]/15                    ← translucent warm tan
        px-4 py-3 shadow-sm
        text-sm text-[#2C2416]
        font-family: DM Sans
```

**Anatomy note:** `rounded-br-sm` creates the chat bubble "tail" effect pointing toward the right (user side). The AI card mirrors this with `rounded-bl-sm`.

---

### 7.3 Analysis Card

The signature output component. Arrives as the AI's "message" — left-aligned chat bubble, styled as a data ledger.

**Shape:**
```
rounded-2xl rounded-bl-sm              ← AI bubble tail on bottom-left
border border-[#D4C4A8]
bg-white
shadow-[0_2px_16px_rgba(0,0,0,0.08)]
max-width: ~92% of chat column
```

**Header stripe:**
```
bg-[#F5EFE5]
border-b border-[#E8D5B5]/50
px-4 py-3
flex items-center justify-between
```

- Left: `[✦ icon circle #2C2416]  [MEAL NAME — 11px, semibold, uppercase, tracking-wider, DM Sans, #2C2416]`
- Right: `[Edit button — rounded-full, border rgba(232,213,181,0.5), text #8B7355, 10px]`
- Icon circle: `h-7 w-7 rounded-full bg-[#2C2416]`, icon color `#C9A87C` (Lucide `sparkles`)

**Column header row:**
```
grid-cols-[1fr_4rem_3rem_3rem_3rem]
bg-[#FEFBF6]/80
border-b border-[#E8D5B5]/30
px-4 py-1.5
text-[9px] font-semibold uppercase tracking-wider
```

| Column | Color |
|--------|-------|
| ITEM | `#8B7355` |
| CAL | `#8B7355` |
| PRO | `text-blue-500` |
| CARB | `text-amber-500` |
| FAT | `text-rose-400` |

**Data rows:**
```
Wrapper: divide-y divide-[#F0EAE0]/40 px-4

Row: grid grid-cols-[1fr_4rem_3rem_3rem_3rem] items-center gap-1 py-2.5 text-xs
     (animated in: opacity 0→1, translateY 4px→0, staggered per row)

Name cell:
  <p class="truncate font-medium text-[13px] text-[#2C2416]">  ← ingredient name
  <p class="text-[10px] text-[#8B7355]">                       ← portion (1 chén, 1 miếng…)

CAL:  text-right font-semibold tabular-nums text-[#2C2416]
PRO:  text-right font-medium tabular-nums text-blue-600
CARB: text-right font-medium tabular-nums text-amber-600
FAT:  text-right font-medium tabular-nums text-rose-500
```

**Total row:**
```
grid grid-cols-[1fr_4rem_3rem_3rem_3rem]
border-t border-[#E8D5B5]/50
bg-[#FEFBF6]/90
px-4 py-3 text-xs

"Total" label: font-semibold text-[#2C2416]
CAL total:     font-semibold tabular-nums text-[#2C2416]
PRO total:     font-semibold tabular-nums text-blue-600
CARB total:    font-semibold tabular-nums text-amber-600
FAT total:     font-semibold tabular-nums text-rose-500
```

**Action buttons (below card, same width):**
```
Container: flex gap-2 (outside card, full width of card)

Cancel:  flex h-full w-full items-center justify-center gap-1.5
         rounded-xl border border-[#E8D5B5]/70 bg-white
         px-3 py-2.5 font-medium text-[#8B7355] text-xs shadow-sm
         transition-all duration-200

Confirm: relative flex flex-1 items-center justify-center gap-1.5
         rounded-xl bg-[#695e4e] px-3 py-2.5
         font-medium text-white text-xs shadow-sm
         transition-all duration-200
         hover:bg-[#5a5043]
         (has ✓ checkmark icon + "Confirm & Log Meal" text)
```

**Full card visual anatomy:**
```
┌─────────────────────────────────────────────────────┐  ← bg-white, border #D4C4A8
│ [✦]  CƠM TẤM SƯỜN BÌ CHẢ...           [✎ Edit]   │  ← bg-[#F5EFE5]
├──────────────────┬──────┬──────┬──────┬─────────────┤
│ ITEM             │ CAL  │ PRO  │ CARB │ FAT         │  ← bg-[#FEFBF6]/80
├──────────────────┼──────┼──────┼──────┼─────────────┤
│ Cơm tấm  1 chén  │ 220  │  5g  │ 45g  │  2g         │  ← row dividers F0EAE0/40
│ Sườn nướng 1 miếng│ 330  │ 28g  │  7g  │ 23g         │
│ Bì  1 phần       │ 110  │  9g  │  6g  │  6g         │
│ Chả trứng 1 miếng│ 135  │ 11g  │  7g  │  9g         │
│ Mỡ hành 1 muỗng  │  45  │  0g  │  0g  │  5g         │
│ Canh chua 1 chén │ 100  │  6g  │ 12g  │  3g         │
├──────────────────┼──────┼──────┼──────┼─────────────┤
│ Total            │ 940  │ 59g  │ 77g  │ 48g         │  ← bg-[#FEFBF6]/90
└─────────────────────────────────────────────────────┘
[ Cancel ]  [ ✓ Confirm & Log Meal ]
```

---

### 7.4 Sidebar Navigation

**Left sidebar:**
```
Container: flex h-full flex-col gap-6 rounded-xl border border-border/80
           bg-white p-3 transition-all duration-300

Section label: text-[10px] font-medium uppercase tracking-[0.04em]
               text-muted-foreground overflow-hidden whitespace-nowrap

Nav item (inactive):
  flex items-center rounded-lg px-3 py-2 transition-all duration-200
  text-muted-foreground
  hover:bg-[#F0EAE0]/60 hover:text-[#2C2416]

Nav item (active):
  flex items-center rounded-lg px-3 py-2
  bg-[#695e4e] text-white shadow-sm shadow-[#695e4e]/20
```

**Timeline (middle column):**
```
Container: w-[212px] shrink-0 border-r border-border/40 py-3 pr-3 overflow-y-auto

Month button: flex items-center gap-2 px-3 transition-colors
              hover:text-[#2C2416]
              label: text-[10px] font-medium uppercase tracking-[0.04em] muted

Week button: flex w-full items-center gap-3 rounded-lg px-3 py-2
             text-sm font-medium tracking-tight text-foreground

Day row (active):
  flex w-full items-center gap-3 rounded-lg px-3 py-2
  bg-[#C9A87C]/30 hover:bg-[#F0EAE0]/40

Connector:
  h-2 w-[13px] rounded-bl-lg border-[#C9A87C] border-b-2 border-l-2
```

**User profile area (sidebar bottom):**
```
flex items-center justify-between rounded-lg p-1.5
Avatar: h-8 w-8 rounded-full bg-gradient-to-br from-[#C9A87C]/30 to-[#E8D5B5]/50
        ring-1 ring-[#C9A87C]/30
Initials: font-bold text-[#695e4e] text-xs
```

---

### 7.5 Buttons

| Variant | Classes | Usage |
|---------|---------|-------|
| **Primary (dark)** | `bg-[#695e4e] text-white rounded-xl px-3 py-2.5 text-xs font-medium shadow-sm hover:bg-[#5a5043]` | Confirm & Log Meal |
| **Secondary (outlined)** | `border border-[#E8D5B5]/70 bg-white text-[#8B7355] rounded-xl px-3 py-2.5 text-xs font-medium shadow-sm` | Cancel |
| **Ghost edit** | `rounded-full border border-[#E8D5B5]/50 px-2.5 py-1 text-[#8B7355] text-[10px] font-medium hover:border-[#C9A87C]/50 hover:bg-[#F0EAE0]/40 hover:text-[#2C2416]` | Edit on card |
| **Icon submit** | `h-8 w-8 rounded-lg bg-[#695e4e] text-white shadow-sm hover:bg-[#5a5043] hover:shadow-md active:scale-95 disabled:opacity-30` | Send in input bar |

**Hover pattern:** All dark buttons darken by one step (`#695e4e` → `#5a5043`). All ghost buttons gain `bg-[#F0EAE0]/40` background. Transition: `duration-200`.

---

### 7.6 Suggestion Chips

Shown on the empty logging state as quick-start prompts.

```
rounded-full border border-[#E8D5B5]/50
px-3 py-1.5 (approx)
text-[#8B7355] text-sm
transition-colors
hover:border-[#C9A87C]/50 hover:bg-[#F0EAE0]/40 hover:text-[#2C2416]
```

Examples: `2 mực kho + cơm` · `Phở bò tái` · `Bún chả Hà Nội`

---

### 7.7 Loading State

The "Analyzing your meal..." state that appears while the AI pipeline runs.

```
Bubble (same position as AI response, left-aligned):
  rounded-2xl rounded-bl-sm
  border border-[#E8D5B5]/50 (approx)
  bg-white
  px-4 py-3
  flex items-center gap-3

Spinner: Lucide loader-circle, animates spin, text-muted-foreground
Text: "Analyzing your meal..." text-sm text-[#8B7355]
```

**Rule:** The loading bubble occupies the exact same position the Analysis Card will appear in. When the response arrives, it replaces the bubble in-place — no layout shift.

---

## 8. Motion Language

### Easing

All motion uses Tailwind's default transition — `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out). The app doesn't use custom spring curves. Duration is the key variable.

### Duration Scale

| Duration | Token | Used for |
|----------|-------|---------|
| `duration-200` | 200ms | Button hover bg, nav item highlight, chip hover |
| `duration-300` | 300ms | Sidebar collapse/expand, input bar border |
| Motion library default | ~300ms | Message bubble entry, analysis card row stagger |

### Chat Message Entry

User bubble and AI card both animate in with the Motion library:
```
initial: { opacity: 0, y: 8 }
animate: { opacity: 1, y: 0 }
transition: { duration: ~0.3, ease: "easeOut" }
```

Analysis card rows stagger with small delay increments (each row animates after the previous).

### Sidebar Collapse

```
Sidebar text labels: max-w-40 → max-w-0, opacity-100 → opacity-0
                     overflow-hidden whitespace-nowrap
                     transition-all duration-300
```

### Active States

- `active:scale-95` on the submit icon button — provides physical "press" confirmation.
- No transform on primary/secondary buttons — only color change.

---

## 9. Voice & Copy Patterns

### Heading copy

The empty state uses **Lora serif** for the question: *"What are you having today?"* This is the only serif copy in the app. It signals that this moment is personal and human, not mechanical.

### Subtext

```
"Describe your meal naturally — Vietnamese or English
 — and I'll break down the macros for you."
```

First person from the AI. Conversational. Comma pause. En-dash breathing room.

### Suggestion chips

Short, natural, Vietnamese-first:
- `2 mực kho + cơm` — portion + dish, no article
- `Phở bò tái` — Vietnamese name only
- `Bún chả Hà Nội` — regional specificity

### Card title

All-caps from sentence case, e.g. `CƠM TẤM SƯỜN BÌ CHẢ VÀ CANH CHUA`. Derived by the AI from the user's input. Never user-edited at this stage.

### Portion labels

Always Vietnamese units below ingredient names: `1 chén`, `1 miếng`, `1 phần`, `1 muỗng cà phê`. These are the visible output of the bowl-calibration system.

### Buttons

| Copy | When |
|------|------|
| `✓ Confirm & Log Meal` | Primary action |
| `Cancel` | Dismiss without logging |
| `Edit` | Re-enter input to change description |
| `Analyzing your meal...` | Loading |

### Rules

- Never say "Error" — say "Something went wrong, try again."
- Never show raw kcal without context (row-level breakdown always visible).
- Always use `~` before estimated totals if surfacing anywhere outside the table.
- Timestamps are `HH:MM AM/PM`, right-aligned, below the card.

---

## 10. Token Reference

Copy-paste reference for implementation. These are the ground-truth design token values.

```css
/* ============================================
   NHẨM DESIGN TOKENS v1.0
   Source: Nhẩm design system, March 2026
   ============================================ */

/* Backgrounds */
--nham-canvas:         #FEFBF6;
--nham-surface:        #FFFFFF;
--nham-card-header:    #F5EFE5;
--nham-hover:          #F0EAE0;
--nham-user-bubble:    rgba(201, 168, 124, 0.15);

/* Text */
--nham-text-primary:   #2C2416;
--nham-text-secondary: #8B7355;
--nham-text-tan:       #C9A87C;

/* Borders */
--nham-border-card:    #D4C4A8;
--nham-border-tan:     rgba(232, 213, 181, 0.50);
--nham-border-row:     rgba(240, 234, 224, 0.40);
--nham-border-input:   rgba(232, 213, 181, 0.40);
--nham-border-bubble:  rgba(201, 168, 124, 0.20);

/* Interactive */
--nham-btn-primary:    #695E4E;
--nham-btn-hover:      #5A5043;
--nham-nav-active:     #695E4E;
--nham-day-active:     rgba(201, 168, 124, 0.30);

/* Macro colors (Tailwind class names) */
--protein-header:  text-blue-500    /* #3B82F6 */
--protein-value:   text-blue-600    /* #2563EB */
--carb-header:     text-amber-500   /* #F59E0B */
--carb-value:      text-amber-600   /* #D97706 */
--fat-header:      text-rose-400    /* #FB7185 */
--fat-value:       text-rose-500    /* #F43F5E */

/* Shadows */
--nham-shadow-card:    0 2px 16px rgba(0, 0, 0, 0.08);
--nham-shadow-input:   0 4px 20px rgba(201, 168, 124, 0.08);
--nham-shadow-focus:   0 4px 20px rgba(201, 168, 124, 0.15);

/* Typography */
--font-display: 'Lora', ui-serif, Georgia, serif;
--font-ui:      'DM Sans', ui-sans-serif, system-ui, sans-serif;

/* Radius */
--radius-card:   16px;   /* rounded-2xl */
--radius-button: 12px;   /* rounded-xl */
--radius-chip:   9999px; /* rounded-full */
--radius-icon:   8px;    /* rounded-lg */
--radius-tail:   4px;    /* rounded-bl-sm / rounded-br-sm */

/* Motion */
--transition-fast:   200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

---

*Nhẩm Design System v1.0 · March 2026*
*Scope: landing page + `/logging` route (auth required for full coverage)*