# Requirements: Nhẩm

**Defined:** 2026-02-28
**Core Value:** Users describe Vietnamese meals in natural language and get reliable, goal-adjusted macro estimates grounded in verified ingredient data.

## v1 Requirements

### Database & Infrastructure

- [x] **DB-01**: `pgvector` extension enabled with embeddings for semantic ingredient matching (handles Vietnamese synonyms like thịt ba chỉ/ba rọi/thịt mỡ and misspellings)
- [x] **DB-02**: `meals` table with denormalized nutrition totals (JSONB bounds: low/mid/high per macro)
- [x] **DB-03**: `meal_items` table linking meals to ingredients with adjusted nutrition
- [x] **DB-04**: `body_weight_log` table with daily weight entries
- [x] **DB-05**: RLS policies on all new tables (users access own data only)

### CI/CD

- [ ] **CI-01**: GitHub Actions CI workflow runs on PRs and pushes to main with parallel quality checks (Biome lint, ESLint, type check, unit tests, production build)
- [ ] **CI-02**: Supabase migration validation in CI — all migrations apply cleanly against local Postgres with pgvector and pg_trgm extensions
- [ ] **CI-03**: Branch protection rules require all CI checks to pass before merging to main

### Onboarding

- [ ] **ONB-01**: User completes body metrics screen (weight, height, age, sex, activity level)
- [ ] **ONB-02**: System calculates TDEE via Mifflin-St Jeor and suggests daily targets
- [ ] **ONB-03**: User selects goal (cutting/bulking/maintenance) and aggression level
- [ ] **ONB-04**: User selects regional food profile (Bắc/Trung/Nam/Tây)
- [ ] **ONB-05**: User configures cooking habits (oil usage, fat trimming, rice portion, sugar in braised dishes)
- [ ] **ONB-06**: User calibrates bowl/portion sizes (optional screen)
- [ ] **ONB-07**: Profile stored in `user_profiles` and editable from settings at any time

### AI Pipeline

- [ ] **AI-01**: LLM decomposes meal description into individual ingredients with estimated quantities
- [ ] **AI-02**: Each ingredient is matched against `vietnamese_food_composition` via semantic vector search (handles synonyms, misspellings, and LLM extraction errors)
- [ ] **AI-03**: LLM produces cooking-adjusted nutrition using DB values + user profile context (region, cooking habits, portion calibration)
- [ ] **AI-04**: Pipeline outputs bounded estimates (low/mid/high) per macro, with goal-adjusted displayed value (upper bound for cutting calories, lower bound for cutting protein, etc.)
- [ ] **AI-05**: Pipeline outputs plain-Vietnamese assumption summary per meal (collapsible "Xem giả định")
- [ ] **AI-06**: Confidence signal (HIGH/MEDIUM/LOW) assigned per ingredient and overall meal
- [ ] **AI-07**: Unmatched ingredients logged server-side for DB expansion; LLM falls back to own knowledge with flagged assumption
- [ ] **AI-08**: LLM classifies meal slot (Sáng/Trưa/Tối/Bữa phụ) if confident; otherwise meal indexed by order only

### Meal Logging

- [ ] **LOG-01**: User types natural Vietnamese meal description in a single text input
- [ ] **LOG-02**: Meal analysis result displayed with per-ingredient breakdown and bounds (expandable)
- [ ] **LOG-03**: User can edit raw input text and re-run analysis
- [ ] **LOG-04**: User can manually override individual macro values (marked visually as manual correction)
- [ ] **LOG-05**: User can delete a meal log
- [ ] **LOG-06**: User can view full assumption breakdown and ingredient-level estimates

### Daily Log

- [ ] **DAY-01**: Default landing screen shows today's meals as cards with macro summaries
- [ ] **DAY-02**: Running daily total with progress bars toward calorie and protein goals
- [ ] **DAY-03**: On-track indicator (green/yellow/red) for daily progress
- [ ] **DAY-04**: Date navigation via calendar picker
- [ ] **DAY-05**: Quick-add floating action button accessible from all screens

### Body Weight

- [ ] **BWT-01**: User can log daily body weight in kg
- [ ] **BWT-02**: Weight displayed as trend line with 7-day rolling average

### Dashboard

- [ ] **DSH-01**: Body weight trend chart (7/30/90 day periods) with rolling average
- [ ] **DSH-02**: Daily calorie intake bar chart with target line overlay and color coding (green/yellow/red)
- [ ] **DSH-03**: Macronutrient averages vs targets for selected period
- [ ] **DSH-04**: Protein consistency score (% of days hitting daily protein target)
- [ ] **DSH-05**: Logging consistency streak counter
- [ ] **DSH-06**: Weekly summary (avg calories, avg protein, weight change, expected vs actual)

### Meal Templates

- [ ] **TPL-01**: User can save a meal as a named template
- [ ] **TPL-02**: User can select a template to log instantly (no AI re-run, stored nutrition reused)
- [ ] **TPL-03**: User can modify a template before saving

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### AI Enhancements
- **AIV2-01**: Clarifying questions flow (AI asks follow-ups for vague descriptions)
- **AIV2-02**: Multi-language support (English meal descriptions)
- **AIV2-03**: Context caching for repeated system prompts (cost optimization)

### Social & Engagement
- **SOC-01**: Share weekly summary with friends
- **SOC-02**: Anonymous aggregate insights ("users in your region typically...")

### Platform
- **PLT-01**: PWA configuration (installable on mobile home screen)
- **PLT-02**: Push notifications for logging reminders

### Monetization
- **MON-01**: Subscription tier with premium features
- **MON-02**: Extended history retention for free tier

## Out of Scope

| Feature | Reason |
|---------|--------|
| Barcode/image scanning | Not the approach — Vietnamese home-cooked food can't be scanned meaningfully |
| Social features | Adds complexity without validating core value |
| Wearable/fitness tracker integration | TDEE is user-input; sync adds dependency risk |
| Recipe builder | Users describe dishes, not build recipes — different product |
| Push notifications | v1 is pull-based; users open app when ready |
| Offline mode | AI pipeline requires internet; no viable offline alternative |
| Native mobile app | Web-first, PWA later; App Store distribution is v2+ |
| Monetization | v1 is validation, not revenue |
| Micronutrient deep UI | Micros stored in DB but not prominently surfaced in v1 |
| Per-meal-slot calorie budgets | Too prescriptive; Vietnamese eating patterns vary too widely |
| Streak gamification | Progress-over-perfection tone; streaks create anxiety |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 1 | Complete |
| DB-04 | Phase 1 | Complete |
| DB-05 | Phase 1 | Complete |
| CI-01 | Phase 1.1 | Pending |
| CI-02 | Phase 1.1 | Pending |
| CI-03 | Phase 1.1 | Pending |
| ONB-01 | Phase 2 | Pending |
| ONB-02 | Phase 2 | Pending |
| ONB-03 | Phase 2 | Pending |
| ONB-04 | Phase 2 | Pending |
| ONB-05 | Phase 2 | Pending |
| ONB-06 | Phase 2 | Pending |
| ONB-07 | Phase 2 | Pending |
| AI-01 | Phase 3 | Pending |
| AI-02 | Phase 3 | Pending |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 3 | Pending |
| AI-05 | Phase 3 | Pending |
| AI-06 | Phase 3 | Pending |
| AI-07 | Phase 3 | Pending |
| AI-08 | Phase 3 | Pending |
| LOG-01 | Phase 4 | Pending |
| LOG-02 | Phase 4 | Pending |
| LOG-03 | Phase 4 | Pending |
| LOG-04 | Phase 4 | Pending |
| LOG-05 | Phase 4 | Pending |
| LOG-06 | Phase 4 | Pending |
| DAY-01 | Phase 5 | Pending |
| DAY-02 | Phase 5 | Pending |
| DAY-03 | Phase 5 | Pending |
| DAY-04 | Phase 5 | Pending |
| DAY-05 | Phase 5 | Pending |
| BWT-01 | Phase 6 | Pending |
| BWT-02 | Phase 6 | Pending |
| DSH-01 | Phase 7 | Pending |
| DSH-02 | Phase 7 | Pending |
| DSH-03 | Phase 7 | Pending |
| DSH-04 | Phase 7 | Pending |
| DSH-05 | Phase 7 | Pending |
| DSH-06 | Phase 7 | Pending |
| TPL-01 | Phase 8 | Pending |
| TPL-02 | Phase 8 | Pending |
| TPL-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2025-07-17 after roadmap creation*
