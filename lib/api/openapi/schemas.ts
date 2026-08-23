import type { JsonSchema } from '@/lib/api/openapi/components';

/**
 * Named response schemas.
 *
 * Two tiers, deliberately. Payloads whose shape is small and stable enough to
 * transcribe faithfully are written out in full. The large aggregates — a day
 * of logged meals, the nutrition overview — are declared as objects with the
 * TypeScript type and source file that define them, rather than a hand-copied
 * property list that would be wrong within a release. A schema that lies is
 * worse for a machine than a schema that says "object, defined here".
 */

/** Tier two: an honest, self-describing placeholder. */
function documented(type: string, file: string, note: string): JsonSchema {
  return {
    type: 'object',
    additionalProperties: true,
    description: `${note}\n\nShape is the TypeScript type \`${type}\` in \`${file}\`. It is not transcribed here because it is large and evolves with the product; treat the fields you read as best-effort.`,
  };
}

const string = (description: string): JsonSchema => ({
  type: 'string',
  description,
});
const number = (description: string): JsonSchema => ({
  type: 'number',
  description,
});

export const SCHEMAS: Record<string, JsonSchema> = {
  Error: {
    type: 'object',
    required: ['error'],
    additionalProperties: false,
    description:
      'The single error envelope every endpoint returns. `code` is the stable, machine-readable identifier; `message` is human-facing and localised where the caller supplied a locale.',
    properties: {
      error: {
        type: 'object',
        required: ['code', 'status', 'retryable', 'message'],
        properties: {
          code: {
            type: 'string',
            description: 'Stable error identifier.',
            enum: [
              'NOT_AUTHENTICATED',
              'PROFILE_NOT_FOUND',
              'VALIDATION_FAILED',
              'NOT_FOUND',
              'CONFLICT',
              'RATE_LIMITED',
              'PIPELINE_TIMEOUT',
              'feature_locked',
              'INTERNAL',
            ],
          },
          status: { type: 'integer', description: 'Mirrors the HTTP status.' },
          retryable: {
            type: 'boolean',
            description:
              'Whether retrying the identical request can succeed. `false` means fix the request or the session first.',
          },
          message: string('Human-readable explanation.'),
          feature: string(
            'Present only on `feature_locked`: the gated feature.'
          ),
          reason: string('Present only on `feature_locked`: why it is gated.'),
        },
      },
    },
  },

  HealthCheck: {
    type: 'object',
    required: ['ok', 'service'],
    description: 'Liveness plus a handful of schema invariants.',
    properties: {
      ok: { type: 'boolean', description: 'True when every check passed.' },
      service: { type: 'string', enum: ['kallo'] },
      checks: {
        type: 'object',
        properties: {
          hasUserProfiles: { type: 'boolean' },
          hasFoodTable: { type: 'boolean' },
          hasFoodSourceId: { type: 'boolean' },
          hasNewUserTrigger: { type: 'boolean' },
          seededFoodRows: { type: 'integer' },
          orphanedAuthUsers: { type: 'integer' },
        },
      },
      error: string(
        'Present instead of `checks` when the probe itself failed.'
      ),
    },
  },

  WaitlistSignupResponse: {
    type: 'object',
    required: ['ok'],
    additionalProperties: false,
    description:
      'Deliberately content-free: identical whether the address is new, already pending, or already confirmed, so the endpoint cannot be used to test whether someone is on the list.',
    properties: { ok: { type: 'boolean', enum: [true] } },
  },

  InvitePreview: {
    type: 'object',
    required: ['inviter', 'status', 'signedOut'],
    description:
      'Preview of a friend-invite link. A blocked edge returns the same 404 as an invalid slug — the payload never reveals that a block exists.',
    properties: {
      inviter: documented(
        'PublicProfile',
        'lib/domain/groups/',
        'The person whose link this is.'
      ),
      status: {
        type: 'string',
        enum: ['self', 'accepted', 'none'],
        description:
          '`self` — your own link. `accepted` — already connected. `none` — connectable.',
      },
      signedOut: {
        type: 'boolean',
        description: 'True when the viewer has no session.',
      },
    },
  },

  WeightSummary: {
    type: 'object',
    description:
      'Weight over a range, plus the trend the clients render. `weights` and `weightDates` are parallel arrays of the same length and order.',
    required: ['range', 'weights', 'weightDates', 'currentWeight'],
    properties: {
      range: { type: 'string', enum: ['30d', '90d'] },
      weights: {
        type: 'array',
        items: { type: 'number' },
        description: 'Kilograms.',
      },
      weightDates: {
        type: 'array',
        items: { type: 'string', format: 'date' },
        description: '`YYYY-MM-DD`, parallel to `weights`.',
      },
      currentWeight: number('Most recent logged weight, kg.'),
      todayWeight: {
        type: ['number', 'null'],
        description: "Today's weight if logged.",
      },
      weightPlaceholder: number('Suggested value for an empty weight input.'),
      daysLogged: { type: 'integer' },
      periodStartWeight: number('Weight at the start of the range, kg.'),
      expectedEndWeight: number('Target weight at the end of the range, kg.'),
      goalDirection: { type: 'string', enum: ['up', 'down', 'flat'] },
      periodElapsedDays: { type: ['integer', 'null'] },
      projectedEndWeight: number('Server-computed forecast, kg.'),
      canProject: {
        type: 'boolean',
        description:
          'False when there is too little data for the forecast to mean anything.',
      },
    },
  },

  Heatmap: {
    type: 'object',
    description:
      'Calorie-adherence grid backing the dashboard consistency view.',
    properties: {
      cells: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            ratio: {
              type: ['number', 'null'],
              description:
                'Adherence ratio for colour grading; null on partial days.',
            },
            consumedRatio: {
              type: ['number', 'null'],
              description:
                'Calories ÷ target, never gated by the partial rule.',
            },
            status: {
              type: 'string',
              enum: ['logged', 'partial', 'unlogged', 'future', 'outside'],
            },
            hasCheatMeal: { type: 'boolean' },
          },
        },
      },
      months: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            month: string('English short name.'),
            monthIndex: { type: 'integer', minimum: 1, maximum: 12 },
            startColumn: { type: 'integer' },
            span: { type: 'integer' },
          },
        },
      },
    },
  },

  DashboardBundle: {
    type: 'object',
    description:
      'The four dashboard payloads in one response. Each slice is byte-identical to its standalone endpoint, so a client can seed four caches from one round-trip.',
    properties: {
      profile: {
        oneOf: [
          { $ref: '#/components/schemas/OnboardingProfile' },
          { type: 'null' },
        ],
        description: 'Null for a user who never finished onboarding.',
      },
      day: { $ref: '#/components/schemas/LoggingDay' },
      weightSummary: { $ref: '#/components/schemas/WeightSummary' },
      heatmap: { $ref: '#/components/schemas/Heatmap' },
    },
  },

  IngredientSearchResults: {
    type: 'object',
    required: ['results'],
    description:
      'Matches from the food-composition tables (Vietnam National Food Composition Table 2007, FAO, USDA).',
    properties: {
      results: {
        type: 'array',
        items: documented(
          'IngredientMatch',
          'lib/domain/ingredients/search/ingredient-search.ts',
          'One matched food-composition row.'
        ),
      },
    },
  },

  LoggingDay: documented(
    'LoggingDayData',
    'lib/api/contracts/meals.ts',
    'Everything logged on one calendar day, with per-meal macros and the day totals.'
  ),
  Meal: documented('Meal', 'lib/api/contracts/meals.ts', 'One logged meal.'),
  MealList: {
    type: 'array',
    items: { $ref: '#/components/schemas/Meal' },
    description: 'Meals for the requested day.',
  },
  OnboardingProfile: documented(
    'Awaited<ReturnType<typeof getOnboardingProfile>>',
    'lib/domain/onboarding/actions.ts',
    'Body metrics, goal, region and cooking habits — the inputs that decide every target the app shows.'
  ),
  NutritionOverview: documented(
    'NutritionOverview',
    'lib/domain/nutrition/types.ts',
    'Micronutrient intake over a range, with the data-coverage figure behind each nutrient.'
  ),
  Entitlements: documented(
    'Entitlements',
    'lib/domain/billing/',
    'Which paid features the current user has, and where that entitlement came from.'
  ),
  ChatGroup: documented(
    'ChatGroup',
    'lib/domain/groups/',
    'A small shared space — housemates, a partner, a training group.'
  ),
  Feed: documented(
    'FeedPage',
    'lib/domain/groups/',
    'A page of shared meals, newest first.'
  ),
  PublicProfile: documented(
    'PublicProfile',
    'lib/domain/groups/',
    'The name and avatar other people see.'
  ),
  /** `{ ok: true }` and friends — endpoints whose value is the status code. */
  Acknowledgement: {
    type: 'object',
    additionalProperties: true,
    description:
      'A small acknowledgement object. The status code carries the outcome; the body carries whatever the action returned, commonly `{ ok: true }` or the updated row.',
  },
};
