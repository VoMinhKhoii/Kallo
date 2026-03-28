# Nhẩm

## What This Is

Nhẩm is a web application where Vietnamese users describe their meals in natural language — exactly as they'd explain to a friend — and receive structured macro and micronutrient estimates powered by an AI pipeline grounded in verified Vietnamese nutritional data. The system is personalized via a regional and dietary onboarding profile that shifts the LLM's nutritional priors to match how the user actually cooks and eats.

## Core Value

Users can describe a Vietnamese meal in natural language and get a reliable, goal-adjusted macro estimate grounded in verified ingredient data — accurate enough that consistent use over weeks produces expected body composition changes.

## Requirements

### Validated

- ✓ Landing page — existing
- ✓ Email/password authentication via Supabase Auth — existing
- ✓ Auth middleware with session management and route protection — existing
- ✓ Vietnamese food composition database (526 FAO VN 2007 ingredients seeded) — existing
- ✓ User profiles schema (body metrics, dietary preferences, regional profile) — existing
- ✓ Raw Gemini meal analysis endpoint (ungrounded, no DB lookup) — existing
- ✓ Vercel deployment — existing

### Active

- [ ] Onboarding flow (5 screens: body metrics, goal/targets, regional profile, cooking habits, bowl calibration)
- [ ] Two-layer AI meal analysis pipeline (DB ingredient lookup → LLM cooking adjustment)
- [ ] Bound system (conservative estimates by user goal: cutting/bulking/maintenance)
- [ ] Assumption transparency output per meal
- [ ] Daily log view with meal cards and running totals
- [ ] Body weight logging with trend tracking
- [ ] Meal edit, correction, and deletion
- [ ] Meal templates (save and reuse frequent meals)
- [ ] Dashboard (weight trend, calorie trend, macro averages, protein consistency, logging streak)
- [ ] Weekly summary (expected vs actual weight change)
- [ ] Vietnamese-native UX (portion language, approximate display, progress-over-perfection tone)

### Out of Scope

- Clarifying questions flow — AI estimates and states assumptions, user corrects manually
- Barcode/image scanning — not the approach, not in any version
- Social features — no sharing, challenges, or community
- Wearable/fitness tracker integration — TDEE is user-input only
- Recipe builder — users describe dishes, not build recipes
- Push notifications — users open app when ready to log
- Offline mode — requires internet for AI pipeline
- Native mobile app — web-first, PWA is the mobile strategy
- Monetization — v1 is validation, not revenue
- Micronutrient deep UI — micros stored but not prominently surfaced in v1

## Context

**Founder validation:** The core workflow (natural language → LLM → macro estimate) has been personally validated over weeks of active cutting, producing ~1 kg/week weight loss. Nhẩm productizes this validated manual workflow.

**Why existing apps fail for Vietnamese users:** Barcode scanning is useless for home-cooked food. Image recognition can't distinguish ingredient ratios or cooking methods. Vietnamese eating is communal (shared dishes, self-served portions) — no existing app handles this correctly. Regional variance in macro composition (e.g., cá kho tộ in HCM vs Hà Nội) is meaningful over weeks.

**Current codebase state:**
- Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (New York style)
- Supabase for auth + database (PostgreSQL with RLS)
- Gemini 2.5 Flash for meal analysis (raw call, no DB grounding yet)
- 526 Vietnamese ingredients seeded from FAO VN 2007
- `user_profiles` table schema complete but no onboarding UI
- Biome for linting/formatting, Vitest for testing
- Deployed to Vercel

**Future versions:** v1.2, v2, and beyond are planned but not in scope for this milestone. v1 goal is: onboarding + grounded AI pipeline + daily log + body weight log + dashboard.

## Constraints

- **Tech stack**: Next.js 16 (App Router), Supabase, Gemini 2.5 Flash — already committed, no changes
- **Solo developer**: Scope discipline is critical — the out-of-scope list is a hard boundary
- **AI latency**: Meal analysis should complete within 5–10 seconds with progress indication
- **Accuracy model**: ±15–20% per meal is acceptable; daily/weekly aggregates must be reliable
- **Vietnamese-first**: All UI copy, portion language, and mental models are Vietnamese-native
- **Budget**: Free-tier Supabase and Vercel; Gemini API costs must stay minimal

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-layer nutrition (DB ground truth + LLM adjustment) | LLM alone hallucinates nutrition values; grounding with verified data dramatically improves accuracy | — Pending |
| Bound system (upper/lower/mid by goal) | Single point estimates create false precision; goal-adjusted bounds give users actionable confidence | — Pending |
| Regional profile as LLM prior | Same dish name has meaningfully different macros across Vietnamese regions; profile eliminates systematic bias | — Pending |
| Gemini 2.5 Flash as primary model | Cost-efficient, strong Vietnamese language understanding, structured output support | ✓ Good |
| Supabase for auth + DB | Free tier, built-in RLS, auth out of the box — reduces v1 complexity | ✓ Good |
| No clarifying questions in v1 | Adds UX complexity; estimate + assumption transparency + manual correction is simpler and sufficient | — Pending |

---
*Last updated: 2026-02-28 after initialization*
