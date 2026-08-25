import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { JsonSchema } from '@/lib/api/openapi/components';

const nullableNumber: JsonSchema = { type: ['number', 'null'] };
const nullableString: JsonSchema = { type: ['string', 'null'] };
const uuid: JsonSchema = { type: 'string', format: 'uuid' };

function object(
  properties: Record<string, JsonSchema>,
  required: string[] = Object.keys(properties)
): JsonSchema {
  return { type: 'object', additionalProperties: false, required, properties };
}

const array = (items: JsonSchema): JsonSchema => ({ type: 'array', items });

const nutritionValues = object(
  Object.fromEntries(NUTRITION_KEYS.map((key) => [key, nullableNumber]))
);

const publicProfile = object({
  userId: uuid,
  handle: { type: 'string' },
  displayName: nullableString,
  avatarSeed: nullableString,
  avatarUrl: { type: ['string', 'null'], format: 'uri' },
  hasCustomAvatar: { type: 'boolean' },
});

const ingredient = object({
  id: uuid,
  ingredientName: { type: 'string' },
  foodCompositionId: nullableString,
  estimatedGrams: nullableNumber,
  userFacingUnit: nullableString,
  cookingMethod: nullableString,
  matchConfidence: nullableNumber,
  nutrition: nutritionValues,
});

const mealItemGroup = object({
  name: { type: 'string' },
  order: { type: 'integer' },
  ingredients: array(ingredient),
  nutrition: nutritionValues,
});

const meal = object(
  {
    id: uuid,
    rawInput: { type: 'string' },
    mealSlot: nullableString,
    confidenceOverall: nullableString,
    loggedAt: { type: 'string', format: 'date-time' },
    nutrition: nutritionValues,
    mealItemGroups: array(mealItemGroup),
    entryMode: { type: 'string', enum: ['precise', 'cheat'] },
    alcoholG: nullableNumber,
    cheatSliders: {
      type: ['object', 'null'],
      description: 'Persisted cheat-mode slider specification and levels.',
    },
    share: {
      oneOf: [
        object({ shareId: uuid, visibility: { type: 'string' } }),
        { type: 'null' },
      ],
    },
    portionFactor: { type: 'number', minimum: 0 },
  },
  [
    'id',
    'rawInput',
    'mealSlot',
    'confidenceOverall',
    'loggedAt',
    'nutrition',
    'mealItemGroups',
    'entryMode',
    'alcoholG',
    'cheatSliders',
    'share',
  ]
);

const pendingMeal = object(
  {
    id: uuid,
    rawInput: { type: 'string' },
    loggedAt: { type: 'string', format: 'date-time' },
    parsedMeal: {
      type: 'object',
      description: 'Parsed precise-meal review payload.',
    },
    cheatSpec: {
      type: 'object',
      description: 'Cheat-mode slider review payload.',
    },
  },
  ['id', 'rawInput', 'loggedAt']
);

const ingredientSearchResult = object(
  {
    id: { type: 'string' },
    namePrimary: { type: 'string' },
    nameEn: nullableString,
    nameAlt: { type: ['array', 'null'], items: { type: 'string' } },
    state: { type: 'string' },
    similarity: { type: 'number' },
    semantic: { type: 'boolean' },
    per100g: object({
      caloriesKcal: nullableNumber,
      proteinG: nullableNumber,
      carbohydrateG: nullableNumber,
      fatG: nullableNumber,
    }),
  },
  ['id', 'namePrimary', 'nameEn', 'nameAlt', 'state', 'similarity', 'per100g']
);

const onboardingProfile = object(
  {
    userId: uuid,
    weightKg: nullableString,
    heightCm: { type: ['integer', 'null'] },
    age: { type: ['integer', 'null'] },
    biologicalSex: nullableString,
    activityLevel: nullableString,
    tdeeKcal: { type: ['integer', 'null'] },
    goal: nullableString,
    aggression: nullableString,
    carbSplit: nullableString,
    calorieTarget: { type: ['integer', 'null'] },
    proteinTargetG: { type: ['integer', 'null'] },
    carbsTargetG: { type: ['integer', 'null'] },
    fatTargetG: { type: ['integer', 'null'] },
    countryOfOrigin: nullableString,
    countryOfResidence: nullableString,
    preferredLocale: nullableString,
    oilUsage: nullableString,
    defaultRicePortion: nullableString,
    sugarBraised: nullableString,
    defaultProteinPortion: nullableString,
    brothConsumption: nullableString,
    onboardingStep: { type: 'integer' },
    onboardingCompletedAt: { type: ['string', 'null'], format: 'date-time' },
    onboardingMinimizedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  ['userId', 'onboardingStep']
);

const calorieScope = object({
  averagePerDay: nullableNumber,
  days: { type: 'integer', minimum: 0 },
});

const nutritionOverview = object({
  requestedRange: { type: 'string', enum: ['auto', '1d', '7d', '30d', '90d'] },
  resolvedRange: { type: 'string', enum: ['1d', '7d', '30d', '90d'] },
  bucketTimezone: { type: 'string', enum: ['local', 'utc'] },
  loggedDays: { type: 'integer', minimum: 0 },
  completeDays: { type: 'integer', minimum: 0 },
  partialDays: { type: 'integer', minimum: 0 },
  loggedDaysLast30: { type: 'integer', minimum: 0 },
  trendStatus: { type: 'string', enum: ['ready', 'too_few_logged_days'] },
  period: object({
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
  }),
  summary: object({
    mostConsistent: { type: 'array', items: { type: 'object' } },
    needsAttention: { type: 'array', items: { type: 'object' } },
    limitedDataCount: { type: 'integer', minimum: 0 },
    macroConsistency: object({
      averageConsistencyPct: { type: 'number' },
      weakestMacro: {
        type: ['string', 'null'],
        enum: ['calories', 'protein', 'carbohydrate', 'fat', null],
      },
    }),
  }),
  calorieAverages: object({ all: calorieScope, complete: calorieScope }),
  previousCalorieAverages: object({
    all: calorieScope,
    complete: calorieScope,
  }),
  macros: { type: 'array', items: { type: 'object' } },
  daySeries: object({
    unit: { type: 'string', enum: ['day', 'week'] },
    series: { type: 'array', items: { type: 'object' } },
  }),
  micronutrients: { type: 'array', items: { type: 'object' } },
  spotlight: { type: 'array', items: { type: 'object' } },
  steady: { type: 'array', items: { type: 'object' } },
  moreNutrients: { type: 'array', items: { type: 'object' } },
  educationCards: { type: 'array', items: { type: 'object' } },
});

const entitlements = object({
  userId: uuid,
  purchasesEnabled: { type: 'boolean' },
  tier: { type: 'string', enum: ['free', 'premium'] },
  reconciliationRequired: { type: 'boolean' },
  isLifetime: { type: 'boolean' },
  expiresAt: { type: ['string', 'null'], format: 'date-time' },
  willRenew: { type: 'boolean' },
  source: nullableString,
  store: nullableString,
  managementUrl: { type: ['string', 'null'], format: 'uri' },
  managementStore: nullableString,
  hasActiveSubscription: { type: 'boolean' },
  trial: object({
    active: { type: 'boolean' },
    endsAt: { type: ['string', 'null'], format: 'date-time' },
    daysRemaining: { type: 'integer', minimum: 0 },
  }),
  features: object({
    ai_analysis: object({
      allowed: { type: 'boolean' },
      reason: {
        type: 'string',
        enum: ['entitled', 'trial', 'trial_expired', 'not_entitled'],
      },
    }),
  }),
});

const chatGroupIdentity = object({
  id: uuid,
  kind: { type: 'string', enum: ['direct', 'group'] },
  title: { type: 'string' },
  avatarSeed: nullableString,
  updatedAt: { type: 'string', format: 'date-time' },
  lastMessagePreview: nullableString,
  lastMessageAt: { type: ['string', 'null'], format: 'date-time' },
  unread: { type: 'boolean' },
  lastMealSharedAt: { type: ['string', 'null'], format: 'date-time' },
});

const chatGroupDetail = object({
  id: uuid,
  kind: { type: 'string', enum: ['direct', 'group'] },
  name: nullableString,
  members: array(
    object({
      userId: uuid,
      handle: { type: 'string' },
      displayName: nullableString,
      avatarSeed: nullableString,
      avatarUrl: { type: ['string', 'null'], format: 'uri' },
      hasCustomAvatar: { type: 'boolean' },
      role: { type: 'string' },
    })
  ),
  myRole: { type: 'string', enum: ['owner', 'member'] },
});

const sharedMealEntry = object({
  friend: publicProfile,
  isSelf: { type: 'boolean' },
  meal: object({
    mealId: uuid,
    shareId: uuid,
    rawInput: { type: 'string' },
    caloriesKcal: nullableNumber,
    proteinG: nullableNumber,
    carbohydrateG: nullableNumber,
    fatG: nullableNumber,
    portionFactor: { type: 'number' },
    sharedAt: { type: 'string', format: 'date-time' },
    isBackfilled: { type: 'boolean' },
  }),
  reactions: object({ count: { type: 'integer' }, mine: { type: 'boolean' } }),
  replies: array({ type: 'object' }),
  repliesTotal: { type: 'integer', minimum: 0 },
});

const acknowledgement = object(
  {
    success: { type: 'boolean' },
    ok: { type: 'boolean' },
    id: uuid,
    mealId: uuid,
    analysisId: uuid,
    path: { type: 'string' },
    status: { type: 'string' },
    added: { type: 'integer' },
    removed: { type: 'boolean' },
    left: { type: 'boolean' },
    lastReadAt: { type: 'string', format: 'date-time' },
    autoShareToCircle: { type: 'boolean' },
    data: { type: 'object' },
  },
  []
);

const relogMacroSummary = {
  totalGrams: nullableNumber,
  caloriesKcal: nullableNumber,
  proteinG: nullableNumber,
  carbohydrateG: nullableNumber,
  fatG: nullableNumber,
};

const relogDishCandidate = object({
  kind: { type: 'string', enum: ['dish'] },
  sourceMealId: uuid,
  mealItemOrder: { type: 'integer', minimum: 0 },
  name: { type: 'string' },
  ingredientCount: { type: 'integer', minimum: 0 },
  occurrenceCount: { type: 'integer', minimum: 1 },
  lastLoggedAt: { type: 'string', format: 'date-time' },
  ...relogMacroSummary,
});

const relogMealCandidate = object({
  kind: { type: 'string', enum: ['meal'] },
  sourceMealId: uuid,
  name: { type: 'string' },
  dishCount: { type: 'integer', minimum: 0 },
  occurrenceCount: { type: 'integer', minimum: 1 },
  lastLoggedAt: { type: 'string', format: 'date-time' },
  ...relogMacroSummary,
});

export const RESPONSE_SCHEMAS: Record<string, JsonSchema> = {
  NutritionValues: nutritionValues,
  PublicProfile: publicProfile,
  IngredientSearchResult: ingredientSearchResult,
  LoggingDay: object({
    persistedMeals: array(meal),
    pendingConfirmations: array(pendingMeal),
  }),
  Meal: meal,
  PendingMeal: pendingMeal,
  RecentCheatOccasion: object({
    mealId: uuid,
    rawInput: { type: 'string' },
    loggedAt: { type: 'string', format: 'date-time' },
  }),
  RelogCandidates: object({
    dishes: array(relogDishCandidate),
    meals: array(relogMealCandidate),
  }),
  StagedRelogAnalysis: object({
    analysisId: uuid,
    parsedMeal: {
      type: 'object',
      description: 'Parsed precise-meal payload ready for user review.',
    },
    rawInput: { type: 'string' },
    loggedAt: { type: 'string', format: 'date-time' },
  }),
  OnboardingProfile: onboardingProfile,
  NutritionOverview: nutritionOverview,
  Entitlements: entitlements,
  ChatGroup: { oneOf: [chatGroupIdentity, chatGroupDetail] },
  Feed: object({ entries: array(sharedMealEntry), nextCursor: nullableString }),
  Acknowledgement: acknowledgement,
};
