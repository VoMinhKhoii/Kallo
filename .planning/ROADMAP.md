# Roadmap: Nhẩm

## Overview

Nhẩm productizes a validated manual workflow: describe Vietnamese meals in natural language → get grounded macro estimates. The roadmap builds from foundation (schema, pgvector) through personalization (onboarding), to the core product (two-layer AI pipeline + meal logging), then layers on daily tracking, body weight, analytics, and convenience features (templates). Each phase delivers a complete, verifiable capability. The existing codebase provides auth, landing page, a raw Gemini endpoint, and 526 seeded FAO VN 2007 ingredients — this roadmap builds everything on top.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Database Schema & Infrastructure** - New tables, pgvector embeddings, and RLS policies that all features build on
- [ ] **Phase 2: Onboarding** - 5-screen wizard capturing body metrics, goals, regional profile, and cooking habits
- [ ] **Phase 3: AI Pipeline** - Two-layer meal analysis: LLM decomposition → semantic DB grounding → cooking-adjusted bounded estimates
- [ ] **Phase 4: Meal Logging** - Single-input meal logging with confirm, edit, override, and delete
- [ ] **Phase 5: Daily Log View** - Today's meals as cards with running totals, progress bars, and date navigation
- [ ] **Phase 6: Body Weight Tracking** - Daily weight logging with trend line and rolling average
- [ ] **Phase 7: Dashboard & Analytics** - Weight trends, calorie charts, macro averages, protein consistency, and weekly summaries
- [ ] **Phase 8: Meal Templates** - Save, reuse, and modify frequent meals without re-running AI

## Phase Details

### Phase 1: Database Schema & Infrastructure
**Goal**: All data structures and search infrastructure are in place for the app's features
**Depends on**: Nothing (first phase) — builds on existing schema with `user_profiles` and `vietnamese_food_composition` tables
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05
**Success Criteria** (what must be TRUE):
  1. A semantic similarity query against ingredient embeddings returns correct matches for Vietnamese synonym inputs (e.g., "ba rọi" matches "Thịt lợn ba chỉ", "thịt mỡ" matches "Thịt lợn ba chỉ")
  2. A meal record can be inserted and retrieved with JSONB bounded nutrition data (low/mid/high per macro)
  3. Meal items link correctly to both the parent meal and the food composition table with per-item adjusted nutrition
  4. A body weight entry can be inserted and queried by user and date
  5. RLS policies enforce that user A cannot read or write user B's data across all new tables
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Core table schemas (meals, meal_items, body_weight_log, unmatched_ingredients) via Drizzle
- [ ] 01-02-PLAN.md — pgvector embeddings infrastructure (extension, embedding column, HNSW index, match_ingredients function)
- [ ] 01-03-PLAN.md — RLS policies for all new tables (user data isolation)

### Phase 1.1: CI/CD Pipeline (INSERTED)

**Goal:** Automated quality gate via GitHub Actions — lint, type-check, test, build, and Supabase migration validation run on every PR and push to main
**Requirements**: CI-01, CI-02, CI-03
**Depends on:** Phase 1
**Plans:** 1 plan

Plans:
- [ ] 01.1-01-PLAN.md — GitHub Actions CI workflow (6 parallel jobs: Biome, ESLint, TypeScript, unit tests, build, migration validation) + branch protection

### Phase 2: Onboarding
**Goal**: New users can set up their nutritional profile so the AI pipeline has the personal context it needs for accurate estimates
**Depends on**: Phase 1 (user_profiles table already exists; this phase builds UI and TDEE logic)
**Requirements**: ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, ONB-06, ONB-07
**Success Criteria** (what must be TRUE):
  1. User completes body metrics (weight, height, age, sex, activity level) and sees auto-calculated TDEE with suggested daily calorie and macro targets
  2. User selects goal (cutting/bulking/maintenance) with aggression level and sees adjusted targets reflecting that goal
  3. User selects regional food profile (Bắc/Trung/Nam/Tây) and configures cooking habits (oil usage, fat trimming, rice portion, sugar in braised dishes)
  4. User can optionally calibrate bowl/portion sizes or skip with sensible defaults
  5. Completed profile is persisted to `user_profiles` and editable from settings at any time after onboarding
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: AI Pipeline
**Goal**: The system can analyze a Vietnamese meal description and produce a grounded, bounded nutrition estimate with transparent assumptions
**Depends on**: Phase 1 (pgvector embeddings for ingredient matching), Phase 2 (user profile for cooking/regional context)
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08
**Success Criteria** (what must be TRUE):
  1. Given a natural-language Vietnamese meal description, the system decomposes it into individual ingredients with estimated quantities and classifies the meal slot (Sáng/Trưa/Tối/Bữa phụ) when confident
  2. Each extracted ingredient is matched against the food composition DB via pgvector semantic search, with unmatched ingredients logged server-side and handled via LLM fallback with flagged assumption
  3. The system returns bounded macro estimates (low/mid/high) per ingredient and overall meal, adjusted for the user's regional profile and cooking habits, with a confidence signal (HIGH/MEDIUM/LOW) per ingredient and overall
  4. Goal-adjusted display values are computed (upper-bound calories for cutting, lower-bound protein for cutting, etc.)
  5. A plain-Vietnamese assumption summary ("Xem giả định") is generated explaining what the AI assumed about portions, cooking method, and ingredients
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Meal Logging
**Goal**: Users can log meals via natural language, review the AI's analysis, and correct mistakes
**Depends on**: Phase 3 (AI pipeline must produce analysis results)
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06
**Success Criteria** (what must be TRUE):
  1. User types a Vietnamese meal description in a single text input and receives a structured analysis result with per-ingredient breakdown and bounded estimates
  2. User can expand the result to view the full assumption breakdown, ingredient-level estimates, and confidence signals
  3. User can edit the raw input text and re-run analysis to get an updated result
  4. User can manually override individual macro values on a confirmed meal, with overrides visually marked as manual corrections
  5. User can delete a logged meal
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Daily Log View
**Goal**: Users can see their day's nutrition at a glance and navigate between days
**Depends on**: Phase 4 (meals must exist to display)
**Requirements**: DAY-01, DAY-02, DAY-03, DAY-04, DAY-05
**Success Criteria** (what must be TRUE):
  1. The default landing screen (post-onboarding) shows today's meals as cards with macro summaries
  2. Running daily totals display with progress bars toward calorie and protein goals
  3. An on-track indicator (green/yellow/red) reflects daily progress status
  4. User can navigate to any past date via calendar picker to view that day's meals and totals
  5. A quick-add floating action button is accessible from all screens to start logging a new meal
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Body Weight Tracking
**Goal**: Users can track body weight over time and see meaningful trends
**Depends on**: Phase 1 (body_weight_log table)
**Requirements**: BWT-01, BWT-02
**Success Criteria** (what must be TRUE):
  1. User can log their daily body weight in kg from a dedicated input
  2. Weight history displays as a trend line chart with 7-day rolling average smoothing
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Dashboard & Analytics
**Goal**: Users can assess whether their nutrition and weight trends are on track over time
**Depends on**: Phase 4 (meal data for calorie/macro charts), Phase 6 (weight data for trend chart)
**Requirements**: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06
**Success Criteria** (what must be TRUE):
  1. Body weight trend chart displays with selectable periods (7/30/90 days) and rolling average overlay
  2. Daily calorie intake is visualized as a bar chart with target line overlay and color coding (green/yellow/red)
  3. Macronutrient averages vs targets are displayed for the selected period
  4. Protein consistency score (% of days hitting protein target) and logging streak counter are visible
  5. Weekly summary shows average calories, average protein, weight change, and expected vs actual weight comparison
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Meal Templates
**Goal**: Users can save and reuse frequent meals without re-running AI analysis
**Depends on**: Phase 4 (confirmed meals must exist to save as templates)
**Requirements**: TPL-01, TPL-02, TPL-03
**Success Criteria** (what must be TRUE):
  1. User can save a confirmed meal as a named template
  2. User can log a meal instantly by selecting a saved template (no AI re-run; stored nutrition reused)
  3. User can modify a template's name or details before saving
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Schema & Infrastructure | 0/? | Not started | - |
| 2. Onboarding | 0/? | Not started | - |
| 3. AI Pipeline | 0/? | Not started | - |
| 4. Meal Logging | 0/? | Not started | - |
| 5. Daily Log View | 0/? | Not started | - |
| 6. Body Weight Tracking | 0/? | Not started | - |
| 7. Dashboard & Analytics | 0/? | Not started | - |
| 8. Meal Templates | 0/? | Not started | - |
