# Requirements

## Active

### CI-01 — GitHub Actions CI workflow runs on PRs and pushes to main with parallel quality checks (Biome lint, ESLint, type check, unit tests, production build)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

GitHub Actions CI workflow runs on PRs and pushes to main with parallel quality checks (Biome lint, ESLint, type check, unit tests, production build)

### CI-02 — Supabase migration validation in CI — all migrations apply cleanly against local Postgres with pgvector and pg_trgm extensions

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Supabase migration validation in CI — all migrations apply cleanly against local Postgres with pgvector and pg_trgm extensions

### CI-03 — Branch protection rules require all CI checks to pass before merging to main

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Branch protection rules require all CI checks to pass before merging to main

### AI-01 — LLM decomposes meal description into individual ingredients with estimated quantities

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

LLM decomposes meal description into individual ingredients with estimated quantities

### AI-02 — Each ingredient is matched against `vietnamese_food_composition` via semantic vector search (handles synonyms, misspellings, and LLM extraction errors)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Each ingredient is matched against `vietnamese_food_composition` via semantic vector search (handles synonyms, misspellings, and LLM extraction errors)

### AI-03 — LLM produces cooking-adjusted nutrition using DB values + user profile context (region, cooking habits, portion calibration)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

LLM produces cooking-adjusted nutrition using DB values + user profile context (region, cooking habits, portion calibration)

### AI-04 — Pipeline outputs bounded estimates (low/mid/high) per macro, with goal-adjusted displayed value (upper bound for cutting calories, lower bound for cutting protein, etc.)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Pipeline outputs bounded estimates (low/mid/high) per macro, with goal-adjusted displayed value (upper bound for cutting calories, lower bound for cutting protein, etc.)

### AI-05 — Pipeline outputs plain-Vietnamese assumption summary per meal (collapsible "Xem giả định")

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Pipeline outputs plain-Vietnamese assumption summary per meal (collapsible "Xem giả định")

### AI-06 — Confidence signal (HIGH/MEDIUM/LOW) assigned per ingredient and overall meal

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Confidence signal (HIGH/MEDIUM/LOW) assigned per ingredient and overall meal

### AI-07 — Unmatched ingredients logged server-side for DB expansion; LLM falls back to own knowledge with flagged assumption

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Unmatched ingredients logged server-side for DB expansion; LLM falls back to own knowledge with flagged assumption

### AI-08 — LLM classifies meal slot (Sáng/Trưa/Tối/Bữa phụ) if confident; otherwise meal indexed by order only

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

LLM classifies meal slot (Sáng/Trưa/Tối/Bữa phụ) if confident; otherwise meal indexed by order only

### LOG-01 — User types natural Vietnamese meal description in a single text input

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User types natural Vietnamese meal description in a single text input

### LOG-02 — Meal analysis result displayed with per-ingredient breakdown and bounds (expandable)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Meal analysis result displayed with per-ingredient breakdown and bounds (expandable)

### LOG-03 — User can edit raw input text and re-run analysis

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can edit raw input text and re-run analysis

### LOG-04 — User can manually override individual macro values (marked visually as manual correction)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can manually override individual macro values (marked visually as manual correction)

### LOG-05 — User can delete a meal log

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can delete a meal log

### LOG-06 — User can view full assumption breakdown and ingredient-level estimates

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can view full assumption breakdown and ingredient-level estimates

### DAY-01 — Default landing screen shows today's meals as cards with macro summaries

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Default landing screen shows today's meals as cards with macro summaries

### DAY-02 — Running daily total with progress bars toward calorie and protein goals

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Running daily total with progress bars toward calorie and protein goals

### DAY-03 — On-track indicator (green/yellow/red) for daily progress

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

On-track indicator (green/yellow/red) for daily progress

### DAY-04 — Date navigation via calendar picker

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Date navigation via calendar picker

### DAY-05 — Quick-add floating action button accessible from all screens

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Quick-add floating action button accessible from all screens

### BWT-01 — User can log daily body weight in kg

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can log daily body weight in kg

### BWT-02 — Weight displayed as trend line with 7-day rolling average

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Weight displayed as trend line with 7-day rolling average

### DSH-01 — Body weight trend chart (7/30/90 day periods) with rolling average

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Body weight trend chart (7/30/90 day periods) with rolling average

### DSH-02 — Daily calorie intake bar chart with target line overlay and color coding (green/yellow/red)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Daily calorie intake bar chart with target line overlay and color coding (green/yellow/red)

### DSH-03 — Macronutrient averages vs targets for selected period

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Macronutrient averages vs targets for selected period

### DSH-04 — Protein consistency score (% of days hitting daily protein target)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Protein consistency score (% of days hitting daily protein target)

### DSH-05 — Logging consistency streak counter

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Logging consistency streak counter

### DSH-06 — Weekly summary (avg calories, avg protein, weight change, expected vs actual)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Weekly summary (avg calories, avg protein, weight change, expected vs actual)

### TPL-01 — User can save a meal as a named template

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can save a meal as a named template

### TPL-02 — User can select a template to log instantly (no AI re-run, stored nutrition reused)

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can select a template to log instantly (no AI re-run, stored nutrition reused)

### TPL-03 — User can modify a template before saving

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can modify a template before saving

## Validated

### DB-01 — `pgvector` extension enabled with embeddings for semantic ingredient matching (handles Vietnamese synonyms like thịt ba chỉ/ba rọi/thịt mỡ and misspellings)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`pgvector` extension enabled with embeddings for semantic ingredient matching (handles Vietnamese synonyms like thịt ba chỉ/ba rọi/thịt mỡ and misspellings)

### DB-02 — `meals` table with denormalized nutrition totals (JSONB bounds: low/mid/high per macro)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`meals` table with denormalized nutrition totals (JSONB bounds: low/mid/high per macro)

### DB-03 — `meal_items` table linking meals to ingredients with adjusted nutrition

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`meal_items` table linking meals to ingredients with adjusted nutrition

### DB-04 — `body_weight_log` table with daily weight entries

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`body_weight_log` table with daily weight entries

### DB-05 — RLS policies on all new tables (users access own data only)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

RLS policies on all new tables (users access own data only)

### ONB-01 — User completes body metrics screen (weight, height, age, sex, activity level)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User completes body metrics screen (weight, height, age, sex, activity level)

### ONB-02 — System calculates TDEE via Mifflin-St Jeor and suggests daily targets

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

System calculates TDEE via Mifflin-St Jeor and suggests daily targets

### ONB-03 — User selects goal (cutting/bulking/maintenance) and aggression level

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User selects goal (cutting/bulking/maintenance) and aggression level

### ONB-04 — User selects regional food profile (Bắc/Trung/Nam/Tây)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User selects regional food profile (Bắc/Trung/Nam/Tây)

### ONB-05 — User configures cooking habits (oil usage, fat trimming, rice portion, sugar in braised dishes)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User configures cooking habits (oil usage, fat trimming, rice portion, sugar in braised dishes)

### ONB-06 — User calibrates bowl/portion sizes (optional screen)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User calibrates bowl/portion sizes (optional screen)

### ONB-07 — Profile stored in `user_profiles` and editable from settings at any time

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Profile stored in `user_profiles` and editable from settings at any time

## Deferred

## Out of Scope
