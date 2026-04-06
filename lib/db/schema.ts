import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  decimal,
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

    // Screen 1: Body Metrics
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

    // Screen 3: Regional Profile
    regionalProfile: text('regional_profile'),

    // Screen 4: Cooking Habits
    oilUsage: text('oil_usage'),
    defaultRicePortion: text('default_rice_portion'),
    sugarBraised: text('sugar_braised'),
    defaultProteinPortion: text('default_protein_portion'),
    brothConsumption: text('broth_consumption'),

    // Screen 5: Portion Calibration
    bowlSizeMl: smallint('bowl_size_ml').default(200),
    plateSizeMl: smallint('plate_size_ml').default(400),

    // Hand measurements & onboarding progress
    handSpanCm: decimal('hand_span_cm', { precision: 4, scale: 1 }),
    knuckleDepthCm: decimal('knuckle_depth_cm', {
      precision: 3,
      scale: 1,
    }),
    onboardingStep: smallint('onboarding_step').notNull().default(0),
    onboardingCompletedAt: timestamp('onboarding_completed_at', {
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
      'user_profiles_regional_profile_check',
      sql`${table.regionalProfile} IN ('mien_bac', 'mien_trung', 'mien_nam', 'mien_tay')`
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
    check('user_profiles_hand_span_cm_check', sql`${table.handSpanCm} > 0`),
    check(
      'user_profiles_knuckle_depth_cm_check',
      sql`${table.knuckleDepthCm} > 0`
    ),
    check(
      'user_profiles_onboarding_step_check',
      sql`${table.onboardingStep} >= 0 AND ${table.onboardingStep} <= 5`
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

    // Bounded nutrition — JSONB {low, mid, high}
    caloriesKcal: jsonb('calories_kcal'),
    proteinG: jsonb('protein_g'),
    carbohydrateG: jsonb('carbohydrate_g'),
    fatG: jsonb('fat_g'),
    fiberG: jsonb('fiber_g'),
    sodiumMg: jsonb('sodium_mg'),
    calciumMg: jsonb('calcium_mg'),
    ironMg: jsonb('iron_mg'),
    magnesiumMg: jsonb('magnesium_mg'),
    phosphorusMg: jsonb('phosphorus_mg'),
    potassiumMg: jsonb('potassium_mg'),
    zincMg: jsonb('zinc_mg'),
    copperMcg: jsonb('copper_mcg'),
    manganeseMg: jsonb('manganese_mg'),
    betaCaroteneMcg: jsonb('beta_carotene_mcg'),
    vitaminAMcg: jsonb('vitamin_a_mcg'),
    vitaminDMcg: jsonb('vitamin_d_mcg'),
    vitaminEMg: jsonb('vitamin_e_mg'),
    vitaminKMcg: jsonb('vitamin_k_mcg'),
    vitaminCMg: jsonb('vitamin_c_mg'),
    vitaminB1Mg: jsonb('vitamin_b1_mg'),
    vitaminB2Mg: jsonb('vitamin_b2_mg'),
    vitaminPpMg: jsonb('vitamin_pp_mg'),
    vitaminB5Mg: jsonb('vitamin_b5_mg'),
    vitaminB6Mg: jsonb('vitamin_b6_mg'),
    vitaminB9Mcg: jsonb('vitamin_b9_mcg'),
    vitaminB12Mcg: jsonb('vitamin_b12_mcg'),
    vitaminHMcg: jsonb('vitamin_h_mcg'),

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
    index('meals_user_logged_at_idx').on(table.userId, table.loggedAt),
  ]
);

// ---------------------------------------------------------------------------
// Meal Items
// ---------------------------------------------------------------------------

export const mealItems = pgTable('meal_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mealId: uuid('meal_id')
    .notNull()
    .references(() => meals.id, { onDelete: 'cascade' }),
  foodCompositionId: text('food_composition_id').references(
    () => vietnameseFoodComposition.id,
    { onDelete: 'set null' }
  ),
  ingredientName: text('ingredient_name').notNull(),
  estimatedGrams: real('estimated_grams'),
  userFacingUnit: text('user_facing_unit'),
  cookingMethod: text('cooking_method'),
  matchConfidence: real('match_confidence'),

  // Bounded nutrition — JSONB {low, mid, high}
  caloriesKcal: jsonb('calories_kcal'),
  proteinG: jsonb('protein_g'),
  carbohydrateG: jsonb('carbohydrate_g'),
  fatG: jsonb('fat_g'),
  fiberG: jsonb('fiber_g'),
  sodiumMg: jsonb('sodium_mg'),
  calciumMg: jsonb('calcium_mg'),
  ironMg: jsonb('iron_mg'),
  magnesiumMg: jsonb('magnesium_mg'),
  phosphorusMg: jsonb('phosphorus_mg'),
  potassiumMg: jsonb('potassium_mg'),
  zincMg: jsonb('zinc_mg'),
  copperMcg: jsonb('copper_mcg'),
  manganeseMg: jsonb('manganese_mg'),
  betaCaroteneMcg: jsonb('beta_carotene_mcg'),
  vitaminAMcg: jsonb('vitamin_a_mcg'),
  vitaminDMcg: jsonb('vitamin_d_mcg'),
  vitaminEMg: jsonb('vitamin_e_mg'),
  vitaminKMcg: jsonb('vitamin_k_mcg'),
  vitaminCMg: jsonb('vitamin_c_mg'),
  vitaminB1Mg: jsonb('vitamin_b1_mg'),
  vitaminB2Mg: jsonb('vitamin_b2_mg'),
  vitaminPpMg: jsonb('vitamin_pp_mg'),
  vitaminB5Mg: jsonb('vitamin_b5_mg'),
  vitaminB6Mg: jsonb('vitamin_b6_mg'),
  vitaminB9Mcg: jsonb('vitamin_b9_mcg'),
  vitaminB12Mcg: jsonb('vitamin_b12_mcg'),
  vitaminHMcg: jsonb('vitamin_h_mcg'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
      .references(() => authUsers.id),
    rawInput: text('raw_input').notNull(),
    userContextJson: jsonb('user_context_json'),
    status: text('status').notNull().default('pending'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 minutes'`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('pending_analyses_expires_idx').on(table.expiresAt)]
);
