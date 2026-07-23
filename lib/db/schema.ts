import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  decimal,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// Reference to Supabase auth schema
const authSchema = pgSchema('auth');
const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

export const userProfiles = pgTable(
  'user_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),

    // Screen 2: Body Metrics
    weightKg: decimal('weight_kg', { precision: 5, scale: 2 }),
    heightCm: smallint('height_cm'),
    age: smallint('age'),
    biologicalSex: text('biological_sex'),
    activityLevel: text('activity_level'),
    tdeeKcal: smallint('tdee_kcal'),

    // Screen 2: Goal & Targets
    goal: text('goal'),
    aggression: decimal('aggression', { precision: 2, scale: 1 }),
    calorieTarget: smallint('calorie_target'),
    proteinTargetG: smallint('protein_target_g'),
    carbsTargetG: smallint('carbs_target_g'),
    fatTargetG: smallint('fat_target_g'),
    carbSplit: text('carb_split'),

    // Screen 1: Origin & Language
    countryOfOrigin: text('country_of_origin'),
    countryOfResidence: text('country_of_residence'),
    preferredLocale: text('preferred_locale').default('en'),
    autoShareToCircle: boolean('auto_share_to_circle').notNull().default(true),

    // Screen 3: Cooking Habits
    oilUsage: text('oil_usage'),
    defaultRicePortion: text('default_rice_portion'),
    sugarBraised: text('sugar_braised'),
    defaultProteinPortion: text('default_protein_portion'),
    brothConsumption: text('broth_consumption'),

    // Portion defaults & onboarding progress
    onboardingStep: smallint('onboarding_step').notNull().default(0),
    onboardingCompletedAt: timestamp('onboarding_completed_at', {
      withTimezone: true,
    }),
    // When the user dismisses the onboarding nudge to its minimized pill
    // form. NULL = full nudge shown. Set = minimized pill shown.
    // Cleared (back to NULL) when the user clicks the pill to resume,
    // or implicitly when onboarding completes (the nudge unmounts anyway).
    onboardingMinimizedAt: timestamp('onboarding_minimized_at', {
      withTimezone: true,
    }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Domain A: Application data shape constraints — Drizzle is source of truth
    check(
      'user_profiles_biological_sex_check',
      sql`${table.biologicalSex} IN ('male', 'female')`
    ),
    check(
      'user_profiles_activity_level_check',
      sql`${table.activityLevel} IN ('sedentary', 'light', 'moderate', 'very_active')`
    ),
    check(
      'user_profiles_goal_check',
      sql`${table.goal} IN ('cutting', 'bulking', 'maintaining')`
    ),
    check(
      'user_profiles_aggression_check',
      sql`${table.aggression} >= 0.1 AND ${table.aggression} <= 0.8`
    ),
    check(
      'user_profiles_onboarding_step_check',
      sql`${table.onboardingStep} >= 0 AND ${table.onboardingStep} <= 3`
    ),
    check(
      'user_profiles_oil_usage_check',
      sql`${table.oilUsage} IN ('minimal', 'normal', 'heavy')`
    ),
    check(
      'user_profiles_default_rice_portion_check',
      sql`${table.defaultRicePortion} IN ('small', 'medium', 'large')`
    ),
    check(
      'user_profiles_sugar_braised_check',
      sql`${table.sugarBraised} IN ('low', 'medium', 'high')`
    ),
    check(
      'user_profiles_carb_split_check',
      sql`${table.carbSplit} IN ('moderate_carb', 'lower_carb', 'higher_carb')`
    ),
    check(
      'user_profiles_default_protein_portion_check',
      sql`${table.defaultProteinPortion} IN ('small', 'medium', 'large')`
    ),
    check(
      'user_profiles_broth_consumption_check',
      sql`${table.brothConsumption} IN ('leave_it', 'some', 'finish_it')`
    ),
    check(
      'user_profiles_preferred_locale_check',
      sql`${table.preferredLocale} IN ('en', 'vi')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Ingredient Sources (reference table for food composition data origins)
// ---------------------------------------------------------------------------

export const ingredientSources = pgTable('ingredient_sources', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
});

// ---------------------------------------------------------------------------
// Vietnamese Food Composition (FAO + USDA ingredient data)
// ---------------------------------------------------------------------------

export const vietnameseFoodComposition = pgTable(
  'vietnamese_food_composition',
  {
    id: text('id').primaryKey(),
    namePrimary: text('name_primary').notNull(),
    nameAlt: text('name_alt').array(),
    nameEn: text('name_en').notNull(),
    typeVn: text('type_vn').notNull(),
    typeEn: text('type_en').notNull(),
    sourceId: integer('source_id')
      .notNull()
      .default(1)
      .references(() => ingredientSources.id),
    state: text('state').notNull(),
    inediblePortionPct: numeric('inedible_portion_pct'),

    // Packaged-product sizing (Open Food Facts): grams per serving and grams
    // in the whole package. Nullable — most non-packaged rows have neither.
    servingSizeG: numeric('serving_size_g'),
    packageSizeG: numeric('package_size_g'),

    // Macros
    caloriesKcal: numeric('calories_kcal'),
    proteinG: numeric('protein_g'),
    carbohydrateG: numeric('carbohydrate_g'),
    fatG: numeric('fat_g'),
    fiberG: numeric('fiber_g'),

    // Minerals
    sodiumMg: numeric('sodium_mg'),
    calciumMg: numeric('calcium_mg'),
    ironMg: numeric('iron_mg'),
    magnesiumMg: numeric('magnesium_mg'),
    phosphorusMg: numeric('phosphorus_mg'),
    potassiumMg: numeric('potassium_mg'),
    zincMg: numeric('zinc_mg'),
    copperMcg: numeric('copper_mcg'),
    manganeseMg: numeric('manganese_mg'),

    // Fat-soluble vitamins
    betaCaroteneMcg: numeric('beta_carotene_mcg'),
    vitaminAMcg: numeric('vitamin_a_mcg'),
    vitaminDMcg: numeric('vitamin_d_mcg'),
    vitaminEMg: numeric('vitamin_e_mg'),
    vitaminKMcg: numeric('vitamin_k_mcg'),

    // Water-soluble vitamins
    vitaminCMg: numeric('vitamin_c_mg'),
    vitaminB1Mg: numeric('vitamin_b1_mg'),
    vitaminB2Mg: numeric('vitamin_b2_mg'),
    vitaminPpMg: numeric('vitamin_pp_mg'),
    vitaminB5Mg: numeric('vitamin_b5_mg'),
    vitaminB6Mg: numeric('vitamin_b6_mg'),
    vitaminB9Mcg: numeric('vitamin_b9_mcg'),
    vitaminB12Mcg: numeric('vitamin_b12_mcg'),
    vitaminHMcg: numeric('vitamin_h_mcg'),

    lastVerified: date('last_verified'),

    // Search infrastructure (populated by triggers/scripts, not app code)
    searchText: text('search_text'),
    searchTextAscii: text('search_text_ascii'),
    embedding: vector('embedding', { dimensions: 768 }),
  },
  (table) => [
    check(
      'vietnamese_food_composition_state_check',
      sql`${table.state} IN ('raw', 'cooked')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    rawInput: text('raw_input').notNull(),
    mealSlot: text('meal_slot'),
    slotOverride: boolean('slot_override').default(false),
    confidenceOverall: text('confidence_overall'),
    loggedAt: timestamp('logged_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Cheat-meal logging (entry_mode='cheat'): a slider-based occasion estimate
    // that bypasses ingredient decomposition. 'precise' is the default pipeline.
    entryMode: text('entry_mode').notNull().default('precise'),
    // Alcohol (ethanol) grams — the one calorie source the P/C/F sliders can't
    // hold (~7 kcal/g). Nullable; only populated for cheat meals with drinks.
    alcoholG: numeric('alcohol_g', { mode: 'number' }),
    // Slider spec + the user's chosen levels, so a cheat meal can be re-edited
    // or repeated. Shape: { spec: CheatSliderSpec, levels: CheatSliderLevels }.
    cheatSliders: jsonb('cheat_sliders'),
    // ≤280-char "we get the occasion" line shown on the cheat-meal card.
    estimateRationale: text('estimate_rationale'),
    // Fraction of the "natural full portion" this logged meal represents. 1 for
    // a normal meal or a full copy; <1 for a split (sender's share, or a
    // recipient's accepted split copy). Powers the "½ portion" chip and blocks
    // re-splitting an already-fractional meal (which would compound the shrink)
    // and NL-refine (which would re-estimate the full portion, silently undoing
    // the split).
    portionFactor: numeric('portion_factor', { mode: 'number' })
      .notNull()
      .default(1),

    // Persisted nutrition — one numeric value per nutrient
    caloriesKcal: numeric('calories_kcal', { mode: 'number' }),
    proteinG: numeric('protein_g', { mode: 'number' }),
    carbohydrateG: numeric('carbohydrate_g', { mode: 'number' }),
    fatG: numeric('fat_g', { mode: 'number' }),
    fiberG: numeric('fiber_g', { mode: 'number' }),
    sodiumMg: numeric('sodium_mg', { mode: 'number' }),
    calciumMg: numeric('calcium_mg', { mode: 'number' }),
    ironMg: numeric('iron_mg', { mode: 'number' }),
    magnesiumMg: numeric('magnesium_mg', { mode: 'number' }),
    phosphorusMg: numeric('phosphorus_mg', { mode: 'number' }),
    potassiumMg: numeric('potassium_mg', { mode: 'number' }),
    zincMg: numeric('zinc_mg', { mode: 'number' }),
    copperMcg: numeric('copper_mcg', { mode: 'number' }),
    manganeseMg: numeric('manganese_mg', { mode: 'number' }),
    betaCaroteneMcg: numeric('beta_carotene_mcg', { mode: 'number' }),
    vitaminAMcg: numeric('vitamin_a_mcg', { mode: 'number' }),
    vitaminDMcg: numeric('vitamin_d_mcg', { mode: 'number' }),
    vitaminEMg: numeric('vitamin_e_mg', { mode: 'number' }),
    vitaminKMcg: numeric('vitamin_k_mcg', { mode: 'number' }),
    vitaminCMg: numeric('vitamin_c_mg', { mode: 'number' }),
    vitaminB1Mg: numeric('vitamin_b1_mg', { mode: 'number' }),
    vitaminB2Mg: numeric('vitamin_b2_mg', { mode: 'number' }),
    vitaminPpMg: numeric('vitamin_pp_mg', { mode: 'number' }),
    vitaminB5Mg: numeric('vitamin_b5_mg', { mode: 'number' }),
    vitaminB6Mg: numeric('vitamin_b6_mg', { mode: 'number' }),
    vitaminB9Mcg: numeric('vitamin_b9_mcg', { mode: 'number' }),
    vitaminB12Mcg: numeric('vitamin_b12_mcg', { mode: 'number' }),
    vitaminHMcg: numeric('vitamin_h_mcg', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'meals_meal_slot_check',
      sql`${table.mealSlot} IN ('breakfast', 'brunch', 'lunch', 'dinner', 'snack')`
    ),
    check(
      'meals_confidence_overall_check',
      sql`${table.confidenceOverall} IN ('high', 'medium', 'low')`
    ),
    check(
      'meals_entry_mode_check',
      sql`${table.entryMode} IN ('precise', 'cheat')`
    ),
    // Defense-in-depth: the app only ever derives alcohol from non-negative
    // slider anchors, but guard the column so a bypassed path can't corrupt
    // nutrition aggregates with a negative value.
    check(
      'meals_alcohol_g_non_negative_check',
      sql`${table.alcoholG} IS NULL OR ${table.alcoholG} >= 0`
    ),
    index('meals_user_logged_at_idx').on(table.userId, table.loggedAt),
  ]
);

// ---------------------------------------------------------------------------
// Meal Items
// ---------------------------------------------------------------------------

export const mealItems = pgTable(
  'meal_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mealId: uuid('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    foodCompositionId: text('food_composition_id').references(
      () => vietnameseFoodComposition.id,
      { onDelete: 'set null' }
    ),
    ingredientName: text('ingredient_name').notNull(),
    mealItemName: text('meal_item_name').notNull(),
    mealItemOrder: integer('meal_item_order').notNull().default(0),
    estimatedGrams: real('estimated_grams'),
    userFacingUnit: text('user_facing_unit'),
    cookingMethod: text('cooking_method'),
    matchConfidence: real('match_confidence'),

    // Persisted nutrition — one numeric value per nutrient
    caloriesKcal: numeric('calories_kcal', { mode: 'number' }),
    proteinG: numeric('protein_g', { mode: 'number' }),
    carbohydrateG: numeric('carbohydrate_g', { mode: 'number' }),
    fatG: numeric('fat_g', { mode: 'number' }),
    fiberG: numeric('fiber_g', { mode: 'number' }),
    sodiumMg: numeric('sodium_mg', { mode: 'number' }),
    calciumMg: numeric('calcium_mg', { mode: 'number' }),
    ironMg: numeric('iron_mg', { mode: 'number' }),
    magnesiumMg: numeric('magnesium_mg', { mode: 'number' }),
    phosphorusMg: numeric('phosphorus_mg', { mode: 'number' }),
    potassiumMg: numeric('potassium_mg', { mode: 'number' }),
    zincMg: numeric('zinc_mg', { mode: 'number' }),
    copperMcg: numeric('copper_mcg', { mode: 'number' }),
    manganeseMg: numeric('manganese_mg', { mode: 'number' }),
    betaCaroteneMcg: numeric('beta_carotene_mcg', { mode: 'number' }),
    vitaminAMcg: numeric('vitamin_a_mcg', { mode: 'number' }),
    vitaminDMcg: numeric('vitamin_d_mcg', { mode: 'number' }),
    vitaminEMg: numeric('vitamin_e_mg', { mode: 'number' }),
    vitaminKMcg: numeric('vitamin_k_mcg', { mode: 'number' }),
    vitaminCMg: numeric('vitamin_c_mg', { mode: 'number' }),
    vitaminB1Mg: numeric('vitamin_b1_mg', { mode: 'number' }),
    vitaminB2Mg: numeric('vitamin_b2_mg', { mode: 'number' }),
    vitaminPpMg: numeric('vitamin_pp_mg', { mode: 'number' }),
    vitaminB5Mg: numeric('vitamin_b5_mg', { mode: 'number' }),
    vitaminB6Mg: numeric('vitamin_b6_mg', { mode: 'number' }),
    vitaminB9Mcg: numeric('vitamin_b9_mcg', { mode: 'number' }),
    vitaminB12Mcg: numeric('vitamin_b12_mcg', { mode: 'number' }),
    vitaminHMcg: numeric('vitamin_h_mcg', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('meal_items_meal_order_idx').on(table.mealId, table.mealItemOrder),
  ]
);

// ---------------------------------------------------------------------------
// Body Weight Log
// ---------------------------------------------------------------------------

export const bodyWeightLog = pgTable(
  'body_weight_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    loggedDate: date('logged_date').notNull(),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('body_weight_log_user_date_uniq').on(table.userId, table.loggedDate),
  ]
);

// ---------------------------------------------------------------------------
// Unmatched Ingredients
// ---------------------------------------------------------------------------

export const unmatchedIngredients = pgTable('unmatched_ingredients', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => authUsers.id, {
    onDelete: 'cascade',
  }),
  mealId: uuid('meal_id').references(() => meals.id, {
    onDelete: 'set null',
  }),
  queryText: text('query_text').notNull(),
  mealContext: text('meal_context'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Precomputed query embeddings cache
// ---------------------------------------------------------------------------

export const ingredientQueryEmbeddings = pgTable(
  'ingredient_query_embeddings',
  {
    nameVi: text('name_vi').primaryKey(),
    nameEn: text('name_en'),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// ---------------------------------------------------------------------------
// Synonym candidates (written by background jobs + async cache-miss logging)
// ---------------------------------------------------------------------------

export const synonymCandidates = pgTable('synonym_candidates', {
  id: serial('id').primaryKey(),
  queriedVi: text('queried_vi').notNull(),
  matchedEn: text('matched_en').notNull(),
  matchedVi: text('matched_vi').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewed: boolean('reviewed').notNull().default(false),
});

// ---------------------------------------------------------------------------
// Pipeline requests — observability table for AI pipeline runs
// ---------------------------------------------------------------------------

export const pipelineRequests = pgTable(
  'pipeline_requests',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    rawInput: text('raw_input').notNull(),
    userContextJson: jsonb('user_context_json'),
    status: text('status').notNull().default('pending'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    promptVersionsUsed: jsonb('prompt_versions_used'),
    replayOfRequestId: uuid('replay_of_request_id'),
    dryRun: boolean('dry_run').notNull().default(false),
  },
  (table) => [
    check(
      'pipeline_requests_status_check',
      sql`${table.status} IN ('pending', 'success', 'error')`
    ),
    index('pipeline_requests_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    foreignKey({
      columns: [table.replayOfRequestId],
      foreignColumns: [table.id],
      name: 'pipeline_requests_replay_of_fk',
    }).onDelete('set null'),
  ]
);

export const pipelineRequestReplayAuditLogs = pgTable(
  'pipeline_request_replay_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    adminUserIdHash: text('admin_user_id_hash').notNull(),
    originalRequestId: uuid('original_request_id').notNull(),
    replayRequestId: uuid('replay_request_id').notNull(),
    dryRun: boolean('dry_run').notNull().default(false),
  },
  (table) => [
    index('pipeline_replay_audit_original_idx').on(table.originalRequestId),
    index('pipeline_replay_audit_replay_idx').on(table.replayRequestId),
    index('pipeline_replay_audit_admin_created_idx').on(
      table.adminUserIdHash,
      table.createdAt
    ),
  ]
);

export const analysisGuardEvents = pgTable(
  'analysis_guard_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    userIdHash: text('user_id_hash'),
    ipHash: text('ip_hash'),
    route: text('route').notNull(),
    reason: text('reason').notNull(),
    retryAfterSeconds: integer('retry_after_seconds'),
  },
  (table) => [
    index('analysis_guard_events_reason_created_idx').on(
      table.reason,
      table.createdAt
    ),
    index('analysis_guard_events_user_created_idx').on(
      table.userIdHash,
      table.createdAt
    ),
  ]
);

export const analysisRateLimitWindows = pgTable(
  'analysis_rate_limit_windows',
  {
    keyKind: text('key_kind').notNull(),
    keyHash: text('key_hash').notNull(),
    route: text('route').notNull(),
    windowKind: text('window_kind').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('analysis_rate_limit_windows_key_uniq').on(
      table.keyKind,
      table.keyHash,
      table.route,
      table.windowKind,
      table.windowStart
    ),
    index('analysis_rate_limit_windows_updated_idx').on(table.updatedAt),
    check(
      'analysis_rate_limit_windows_key_kind_check',
      sql`${table.keyKind} IN ('user', 'ip')`
    ),
    check(
      'analysis_rate_limit_windows_window_kind_check',
      sql`${table.windowKind} IN ('minute', 'hour', 'day')`
    ),
    check('analysis_rate_limit_windows_count_check', sql`${table.count} >= 0`),
  ]
);

export const analysisInFlightLimits = pgTable(
  'analysis_in_flight_limits',
  {
    keyKind: text('key_kind').notNull(),
    keyHash: text('key_hash').notNull(),
    route: text('route').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('analysis_in_flight_limits_key_uniq').on(
      table.keyKind,
      table.keyHash,
      table.route
    ),
    index('analysis_in_flight_limits_updated_idx').on(table.updatedAt),
    check(
      'analysis_in_flight_limits_key_kind_check',
      sql`${table.keyKind} IN ('user')`
    ),
    check('analysis_in_flight_limits_count_check', sql`${table.count} >= 0`),
  ]
);

export const analysisModelBudgetEvents = pgTable(
  'analysis_model_budget_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    requestId: text('request_id'),
    route: text('route').notNull(),
    workKind: text('work_kind').notNull(),
    provider: text('provider').notNull(),
    model: text('model'),
    requestCount: integer('request_count').notNull().default(1),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    errorCategory: text('error_category'),
  },
  (table) => [
    index('analysis_model_budget_events_created_idx').on(table.createdAt),
    index('analysis_model_budget_events_work_created_idx').on(
      table.workKind,
      table.createdAt
    ),
    index('analysis_model_budget_events_provider_error_idx').on(
      table.provider,
      table.errorCategory,
      table.createdAt
    ),
    check(
      'analysis_model_budget_events_work_kind_check',
      sql`${table.workKind} IN ('primary', 'shadow', 'nonessential')`
    ),
    check(
      'analysis_model_budget_events_request_count_check',
      sql`${table.requestCount} >= 0`
    ),
    check(
      'analysis_model_budget_events_input_tokens_check',
      sql`${table.inputTokens} >= 0`
    ),
    check(
      'analysis_model_budget_events_output_tokens_check',
      sql`${table.outputTokens} >= 0`
    ),
    check(
      'analysis_model_budget_events_error_category_check',
      sql`${table.errorCategory} IS NULL OR ${table.errorCategory} IN ('rate_limit', 'quota', 'server_error', 'timeout', 'network', 'unknown')`
    ),
  ]
);

export const pendingAnalyses = pgTable(
  'pending_analyses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    pipelineResult: jsonb('pipeline_result').notNull(),
    rawInput: text('raw_input').notNull(),
    // Stable per-logging-attempt id from the client. Re-analyzing the same card
    // (cheat-clarify, retry) reuses it, so the insert upserts the SAME row
    // instead of leaving an orphan pending row behind (which would render as a
    // duplicate "unsaved" card). Nullable: legacy rows and non-analyze staging
    // paths (barcode, cheat-repeat) have none, and PG treats NULLs as distinct
    // in the unique index below, so they never collide.
    attemptId: uuid('attempt_id'),
    // Mirrors meals.entry_mode so confirmAndSaveMealAction can branch without
    // unpacking the JSONB. 'precise' is the default pipeline.
    entryMode: text('entry_mode').notNull().default('precise'),
    loggedAt: timestamp('logged_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 minutes'`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'pending_analyses_entry_mode_check',
      sql`${table.entryMode} IN ('precise', 'cheat')`
    ),
    index('pending_analyses_expires_idx').on(table.expiresAt),
    index('pending_analyses_user_logged_at_idx').on(
      table.userId,
      table.loggedAt
    ),
    // One live staging row per (user, attempt): the analyze insert upserts on
    // this so a re-analysis supersedes its predecessor rather than orphaning it.
    uniqueIndex('pending_analyses_user_attempt_key').on(
      table.userId,
      table.attemptId
    ),
  ]
);

// ---------------------------------------------------------------------------
// Admin pipeline dashboard — trace tables (Chunk 1)
// ---------------------------------------------------------------------------

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    codeHash: text('code_hash').notNull(),
    templateSample: text('template_sample').notNull(),
    model: text('model').notNull(),
    gitSha: text('git_sha'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('prompt_versions_name_hash_uq').on(t.name, t.codeHash),
    index('prompt_versions_name_first_seen_idx').on(
      t.name,
      sql`${t.firstSeenAt} DESC`
    ),
  ]
);

export const pipelineStageLogs = pgTable(
  'pipeline_stage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => pipelineRequests.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(),
    stageIndex: integer('stage_index').notNull(),
    inputJson: jsonb('input_json'),
    outputJson: jsonb('output_json'),
    status: text('status').notNull(),
    error: text('error'),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'pipeline_stage_logs_stage_chk',
      sql`${t.stage} IN ('decomposition','matching','nutrition','assembly')`
    ),
    check(
      'pipeline_stage_logs_status_chk',
      sql`${t.status} IN ('success','error','skipped')`
    ),
    index('pipeline_stage_logs_req_idx').on(t.requestId, t.stageIndex),
  ]
);

export const pipelineLlmCalls = pgTable(
  'pipeline_llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => pipelineRequests.id, { onDelete: 'cascade' }),
    stageLogId: uuid('stage_log_id').notNull(), // intentionally NOT a FK; see spec §5.3
    promptVersionId: uuid('prompt_version_id')
      .notNull()
      .references(() => promptVersions.id),
    model: text('model').notNull(),
    promptRendered: text('prompt_rendered').notNull(),
    responseRaw: text('response_raw'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms').notNull(),
    attempt: integer('attempt').notNull().default(1),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('pipeline_llm_calls_req_idx').on(t.requestId),
    index('pipeline_llm_calls_pv_idx').on(t.promptVersionId),
    index('pipeline_llm_calls_stage_log_idx').on(t.stageLogId),
  ]
);

export const pipelineLlmCallMetadata = pgTable('pipeline_llm_call_metadata', {
  llmCallId: uuid('llm_call_id')
    .primaryKey()
    .references(() => pipelineLlmCalls.id, { onDelete: 'cascade' }),
  provider: text('provider'),
  region: text('region'),
  cacheStatus: text('cache_status'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cachedTokens: integer('cached_tokens'),
  thoughtTokens: integer('thought_tokens'),
  promptChars: integer('prompt_chars'),
  schemaChars: integer('schema_chars'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// pipeline_runs — durable structured telemetry for KPI rollups (§5.1) and
// shadow A/B comparison (§5.2). user_id_hash only, never raw user id.
// Prompt/schema versions are NOT stored here — they live in
// pipeline_requests.prompt_versions_used (jsonb), owned by the admin worktree.
// Per-stage timing is in pipeline_stage_logs.duration_ms (admin worktree);
// only the end-to-end total is mirrored here for fast percentile rollups.
export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    userIdHash: text('user_id_hash').notNull(),
    requestId: text('request_id'),
    pipelineVersion: text('pipeline_version').notNull(),
    modelCall1: text('model_call1').notNull(),
    modelCall2: text('model_call2').notNull(),
    escalated: boolean('escalated').notNull().default(false),
    cacheHitL4: boolean('cache_hit_l4').notNull().default(false),
    retryCount: smallint('retry_count').notNull().default(0),
    totalMs: integer('total_ms').notNull().default(0),
    ingredientCount: smallint('ingredient_count').notNull().default(0),
    matchedCount: smallint('matched_count').notNull().default(0),
    unmatchedCount: smallint('unmatched_count').notNull().default(0),
    anomalyTypes: text('anomaly_types')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ambiguityFlagCounts: jsonb('ambiguity_flag_counts')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    rrfSampled: boolean('rrf_sampled').notNull().default(false),
    rrfDisagreementCount: smallint('rrf_disagreement_count'),
    rrfIngredientsObserved: smallint('rrf_ingredients_observed'),
    rrfMeasurementLatencyMs: integer('rrf_measurement_latency_ms'),
    preMatchAliasHits: smallint('pre_match_alias_hits').notNull().default(0),
    cookedToRawFactorFires: smallint('cooked_to_raw_factor_fires')
      .notNull()
      .default(0),
    densityEnvelopeFires: smallint('density_envelope_fires')
      .notNull()
      .default(0),
    macroInconsistentFires: smallint('macro_inconsistent_fires')
      .notNull()
      .default(0),
    dbStateUnknownFires: smallint('db_state_unknown_fires')
      .notNull()
      .default(0),
    retryStep2Count: smallint('retry_step2_count').notNull().default(0),
    languageGuardMisfire: boolean('language_guard_misfire')
      .notNull()
      .default(false),
    languageRetryCount: smallint('language_retry_count').notNull().default(0),
    aliasFallbackFired: boolean('alias_fallback_fired')
      .notNull()
      .default(false),
    promptPersonalizationFields: text('prompt_personalization_fields')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Phase 4 (D2) — v2 anomaly cause breakdown ({wrong_row, wrong_state,
    // implausible_grams, macro_inconsistent, unmatched_high_uncertainty,
    // legit_prep_adjustment} → count). Migration
    // 20260719143129_add_pipeline_version_and_v2_anomaly_causes.sql is intentionally UNAPPLIED this
    // phase; writePipelineRun tolerates the column's absence (undefined_column
    // → strip + retry) so runs still persist on a pre-migration DB.
    v2AnomalyCauses: jsonb('v2_anomaly_causes').$type<Record<string, number>>(),
  },
  (table) => [
    index('pipeline_runs_language_guard_misfire_idx')
      .on(table.languageGuardMisfire)
      .where(sql`language_guard_misfire = true`),
    index('pipeline_runs_alias_fallback_fired_idx')
      .on(table.aliasFallbackFired)
      .where(sql`alias_fallback_fired = true`),
  ]
);

export const pipelineShadowRuns = pgTable(
  'pipeline_shadow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Joins back to pipeline_runs.request_id to recover input context.
    requestId: text('request_id').notNull(),
    // The primary run that this shadow was paired against.
    primaryRunId: uuid('primary_run_id').references(() => pipelineRuns.id, {
      onDelete: 'set null',
    }),
    candidatePromptLabel: text('candidate_prompt_label').notNull(),
    candidateModel: text('candidate_model').notNull(),
    primaryOutput: jsonb('primary_output').notNull(),
    candidateOutput: jsonb('candidate_output'),
    divergence: jsonb('divergence').notNull(),
    outcome: text('outcome').notNull(),
    candidateMs: integer('candidate_ms').notNull().default(0),
  },
  (table) => [
    index('pipeline_shadow_runs_primary_run_idx').on(table.primaryRunId),
  ]
);

// ---------------------------------------------------------------------------
// Group Tracking — Public Profiles
// ---------------------------------------------------------------------------
// Identity projection table. Holds ONLY the cross-user-visible social fields
// (handle, display name, avatar seed) so that reading another user's social
// identity never touches user_profiles, which co-locates weight_kg/tdee_kcal/
// calorie_target under an owner-only SELECT policy. user_profiles is left
// entirely untouched.
//
// `handle` is modeled as lowercased text + a unique index (not extensions.citext)
// to keep this Drizzle-generated migration free of any dependency on a
// hand-authored CREATE EXTENSION migration; case-insensitivity is enforced in
// the app layer (lowercase on write, exact-match lookup on read).

export const publicProfiles = pgTable(
  'public_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    displayName: text('display_name'),
    avatarSeed: text('avatar_seed'),
    // The person's Google/Gmail picture URL, refreshed from auth metadata on
    // sign-in. Null until captured (or for non-OAuth accounts) — the UI falls
    // back to a letter disc.
    avatarUrl: text('avatar_url'),
    // Storage object path of a user-UPLOADED photo in the public `avatars`
    // bucket ({user_id}/{uuid}.{ext}). Takes precedence over avatar_url in
    // the projected identity; null = fall back to the OAuth picture/initials.
    avatarPath: text('avatar_path'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('public_profiles_handle_uniq').on(table.handle)]
);

// ---------------------------------------------------------------------------
// Friends feed — read marker
// ---------------------------------------------------------------------------
// The combined "all friends" thread isn't a real chat_groups row, so it has
// nowhere to hang a lastReadAt column the way group/direct chats do — this is
// its own table. Deliberately NOT a column on public_profiles: that table's
// RLS lets accepted friends read each other's rows (for names/avatars), and
// this is a private "when did you last check your feed" marker that must
// stay owner-only (see its own RLS migration).

export const friendsFeedReadMarkers = pgTable('friends_feed_read_markers', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Group Tracking — Friendships
// ---------------------------------------------------------------------------
// Symmetric, canonical-ordered friendship edge. The user_low < user_high check
// plus the composite unique structurally forbids duplicate or asymmetric rows.
// status CHECK is pre-widened with every reserved value to satisfy the
// append-only invariant.

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userLow: uuid('user_low')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    userHigh: uuid('user_high')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('friendships_user_low_high_uniq').on(table.userLow, table.userHigh),
    // The composite unique covers the user_low-leading half of the pair lookup;
    // this indexes the user_high = actor branch of the OR in listCircle and the
    // 30s feed poll, which would otherwise seq-scan the whole friend graph.
    index('friendships_user_high_idx').on(table.userHigh),
    check(
      'friendships_user_order_check',
      sql`${table.userLow} < ${table.userHigh}`
    ),
    check(
      'friendships_status_check',
      sql`${table.status} IN ('pending', 'accepted', 'blocked')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Group Tracking — Meal Shares
// ---------------------------------------------------------------------------
// One opt-in row per shared meal. visibility defaults to 'private' — a meal is
// invisible to friends until an explicit 'circle' (or 'public') row exists. The
// partial-unique on meal_id keeps it one-row-per-meal. meals itself is left
// untouched (still private-by-default).

export const mealShares = pgTable(
  'meal_shares',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mealId: uuid('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    visibility: text('visibility').notNull().default('private'),
    sharedAt: timestamp('shared_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('meal_shares_meal_id_uniq').on(table.mealId),
    // Feed driving scan filters shared_at within the day, only non-private rows.
    // The partial predicate keeps the index small (most rows stay private).
    index('meal_shares_shared_at_idx')
      .on(sql`${table.sharedAt} DESC`)
      .where(sql`visibility <> 'private'`),
    // The RLS SELECT policy and feed join filter by actor_id.
    index('meal_shares_actor_idx').on(table.actorId),
    index('meal_shares_actor_shared_at_id_idx')
      .on(table.actorId, sql`${table.sharedAt} DESC`, sql`${table.id} DESC`)
      .where(sql`visibility <> 'private'`),
    check(
      'meal_shares_visibility_check',
      sql`${table.visibility} IN ('private', 'circle', 'public')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Group Tracking — Meal Share Reactions
// ---------------------------------------------------------------------------
// Reactions belong to the broadcast share, not the private meal row. The
// one-per-user constraint makes the v1 heart a true toggle while the widened
// kind CHECK leaves room for richer reactions without another table rewrite.

export const mealShareReactions = pgTable(
  'meal_share_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareId: uuid('share_id')
      .notNull()
      .references(() => mealShares.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('yum'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('meal_share_reactions_share_user_uniq').on(
      table.shareId,
      table.userId
    ),
    check(
      'meal_share_reactions_kind_check',
      sql`${table.kind} IN ('yum', 'cheer', 'strong', 'wow', 'heart')`
    ),
  ]
);

// Replies are lightweight text comments on a broadcast share — the stage-1
// conversation unit in a group (a meal is the thread root; there is no
// universal group chat). Like reactions, they are read and written only
// through server actions on the Drizzle owner connection (RLS enabled, no
// client policies), so canViewShare() is the sole visibility gate. Multiple
// replies per user, ordered by created_at.
export const mealShareReplies = pgTable(
  'meal_share_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareId: uuid('share_id')
      .notNull()
      .references(() => mealShares.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('meal_share_replies_share_created_id_idx').on(
      table.shareId,
      table.createdAt,
      table.id
    ),
  ]
);

// ---------------------------------------------------------------------------
// Group Tracking — Coach Assignments (schema-only, UI dark)
// ---------------------------------------------------------------------------
// Directed coach -> client relationship. Reserved for a later coach console;
// no writes are wired in the MVP. audience_id is the reserved cohort-container
// seam (NULL until coaching-as-business is greenlit). rank/status CHECK lists
// are pre-widened with reserved values for the append-only invariant. The
// partial unique enforces one active primary coach per client.

export const coachAssignments = pgTable(
  'coach_assignments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    rank: text('rank').notNull().default('primary'),
    status: text('status').notNull().default('pending'),
    audienceId: uuid('audience_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'coach_assignments_rank_check',
      sql`${table.rank} IN ('primary', 'secondary')`
    ),
    check(
      'coach_assignments_status_check',
      sql`${table.status} IN ('pending', 'active', 'revoked')`
    ),
    uniqueIndex('coach_assignments_one_active_primary_idx')
      .on(table.clientId)
      .where(sql`rank = 'primary' AND status = 'active'`),
  ]
);

// ---------------------------------------------------------------------------
// Group Tracking — Circle Events
// ---------------------------------------------------------------------------
// Append-only event spine consumed via TanStack refetchInterval polling
// (Realtime deferred). `audience` is the reserved group_id slot (NULL today).
// The type CHECK list is pre-widened with every reserved event type so future
// event kinds need no ALTER.

export const circleEvents = pgTable(
  'circle_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    audience: uuid('audience'),
    type: text('type').notNull(),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'circle_events_type_check',
      sql`${table.type} IN ('meal_shared', 'friend_request', 'friend_accepted', 'coach_nudge', 'streak_milestone', 'recap_ready')`
    ),
    index('circle_events_audience_created_idx').on(
      table.audience,
      sql`${table.createdAt} DESC`
    ),
    index('circle_events_actor_created_idx').on(
      table.actorId,
      sql`${table.createdAt} DESC`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Group Tracking — Meal Share Invites (copy / split between friends)
// ---------------------------------------------------------------------------
// A directed, actionable offer distinct from meal_shares (broadcast visibility):
// friend A shares one of their own meals with a specific friend B, either as a
// full copy or as a split fraction. B one-tap-accepts to materialize a scaled
// copy in their own diary (accepted_meal_id) or dismisses it. This drives the
// Circle inbox. Isolation is the from_user_id / to_user_id filters (Drizzle
// bypasses RLS); invite acceptance is a deliberate cross-user meal read,
// authorized solely by a pending invite row addressed to the reader. The other
// deliberate read starts from meal_shares and is gated by canViewShare.

export const mealShareInvites = pgTable(
  'meal_share_invites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sourceMealId: uuid('source_meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    // Fraction of the source meal the recipient receives: 1 for a full copy,
    // 1/(participants) for a split. Stored so the inbox can label "½ portion"
    // and accept scales the copied rows by exactly this factor.
    portionFactor: numeric('portion_factor').notNull().default('1'),
    status: text('status').notNull().default('pending'),
    // The meal materialized in the recipient's diary once accepted (NULL until).
    acceptedMealId: uuid('accepted_meal_id').references(() => meals.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (table) => [
    // One offer per (meal, recipient): re-sharing upserts instead of piling up
    // duplicate invites.
    unique('meal_share_invites_meal_recipient_uniq').on(
      table.sourceMealId,
      table.toUserId
    ),
    // The inbox query: pending invites addressed to the viewer, newest first.
    index('meal_share_invites_recipient_status_idx')
      .on(table.toUserId, sql`${table.createdAt} DESC`)
      .where(sql`status = 'pending'`),
    check(
      'meal_share_invites_mode_check',
      sql`${table.mode} IN ('copy', 'split')`
    ),
    check(
      'meal_share_invites_status_check',
      sql`${table.status} IN ('pending', 'accepted', 'dismissed')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Chat Groups — unified 1:1 + group messaging
// ---------------------------------------------------------------------------
// One chat concept, N >= 2 members — no separate 1:1 code path. `kind`
// distinguishes an auto-created 2-person chat ('direct', one per accepted
// friendship — created by acceptInvite) from a user-created named chat
// ('group', membership drawn from the creator's existing accepted friends
// only). direct_user_low/high use the SAME canonical-ordering convention as
// friendships.user_low/high (orderedPair()), and are NULL for 'group' rows;
// the unique index on that pair makes direct-chat creation idempotent per
// friend pair (Postgres does not treat NULL = NULL, so 'group' rows with
// both columns NULL never collide with each other).

export const chatGroups = pgTable(
  'chat_groups',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    kind: text('kind').notNull(),
    name: text('name'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    directUserLow: uuid('direct_user_low').references(() => authUsers.id, {
      onDelete: 'cascade',
    }),
    directUserHigh: uuid('direct_user_high').references(() => authUsers.id, {
      onDelete: 'cascade',
    }),
    avatarSeed: text('avatar_seed'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('chat_groups_direct_pair_uniq').on(
      table.directUserLow,
      table.directUserHigh
    ),
    check('chat_groups_kind_check', sql`${table.kind} IN ('direct', 'group')`),
    check(
      'chat_groups_direct_shape_check',
      sql`(${table.kind} = 'direct' AND ${table.directUserLow} IS NOT NULL AND ${table.directUserHigh} IS NOT NULL AND ${table.directUserLow} < ${table.directUserHigh})
          OR (${table.kind} = 'group' AND ${table.directUserLow} IS NULL AND ${table.directUserHigh} IS NULL)`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Chat Groups — Members
// ---------------------------------------------------------------------------

export const chatGroupMembers = pgTable(
  'chat_group_members',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: uuid('group_id')
      .notNull()
      .references(() => chatGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Bumped whenever this member opens messages or the meal feed. Activity
    // after this instant is unread; the default prevents a fresh-join backlog.
    lastReadAt: timestamp('last_read_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('chat_group_members_group_user_uniq').on(
      table.groupId,
      table.userId
    ),
    index('chat_group_members_user_idx').on(table.userId),
    check(
      'chat_group_members_role_check',
      sql`${table.role} IN ('owner', 'member')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Chat Groups — Messages
// ---------------------------------------------------------------------------

export const chatGroupMessages = pgTable(
  'chat_group_messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: uuid('group_id')
      .notNull()
      .references(() => chatGroups.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('chat_group_messages_group_created_idx').on(
      table.groupId,
      sql`${table.createdAt} DESC`
    ),
  ]
);

// ---------------------------------------------------------------------------
// User feedback — in-app bug reports, ingredient requests, and ideas.
// Submitted from web + mobile; triaged by admins via /admin/feedback.
// ---------------------------------------------------------------------------

export const userFeedback = pgTable(
  'user_feedback',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    // 'bug' | 'ingredient' | 'idea'
    type: text('type').notNull(),
    message: text('message').notNull(),
    // Storage object path in the private `feedback-screenshots` bucket.
    screenshotPath: text('screenshot_path'),
    // Context captured client-side at submit time.
    appVersion: text('app_version'),
    // 'web' | 'ios' | 'android' | null (not captured). NULL passes the CHECK
    // (Postgres CHECK only fails on FALSE), so the column stays nullable.
    platform: text('platform'),
    locale: text('locale'),
    route: text('route'),
    metadata: jsonb('metadata'),
    // Admin triage: 'open' | 'triaged' | 'resolved' | 'wontfix'
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'user_feedback_type_check',
      sql`${table.type} IN ('bug', 'ingredient', 'idea')`
    ),
    check(
      'user_feedback_platform_check',
      sql`${table.platform} IN ('web', 'ios', 'android')`
    ),
    check(
      'user_feedback_status_check',
      sql`${table.status} IN ('open', 'triaged', 'resolved', 'wontfix')`
    ),
    index('user_feedback_status_created_idx').on(
      table.status,
      sql`${table.createdAt} DESC`
    ),
    index('user_feedback_type_created_idx').on(
      table.type,
      sql`${table.createdAt} DESC`
    ),
    index('user_feedback_user_created_idx').on(
      table.userId,
      sql`${table.createdAt} DESC`
    ),
  ]
);
