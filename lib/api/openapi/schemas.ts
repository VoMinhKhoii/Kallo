import type { JsonSchema } from '@/lib/api/openapi/components';
import { RESPONSE_SCHEMAS } from '@/lib/api/openapi/schema-shapes';

/**
 * Named response schemas.
 *
 * The detailed application response shapes live in `schema-shapes.ts`; this
 * file owns the protocol-level schemas and composes the complete components
 * map exported by the OpenAPI document.
 */

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
      'The shared API error envelope. `code` is stable, `message` is human-facing, and `resolution` is the next machine-actionable step.',
    properties: {
      error: {
        type: 'object',
        required: ['code', 'status', 'retryable', 'message', 'resolution'],
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
          resolution: string(
            'Machine-actionable next step that does not require parsing the message.'
          ),
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
      inviter: { $ref: '#/components/schemas/PublicProfile' },
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
    required: ['cells', 'monthHeaders'],
    additionalProperties: false,
    description:
      'Calorie-adherence grid backing the dashboard consistency view.',
    properties: {
      cells: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['date', 'ratio', 'consumedRatio', 'status'],
            additionalProperties: false,
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
      },
      monthHeaders: {
        type: 'array',
        items: {
          type: 'object',
          required: ['month', 'monthIndex', 'startColumn', 'span'],
          additionalProperties: false,
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
        items: { $ref: '#/components/schemas/IngredientSearchResult' },
      },
    },
  },
  ...RESPONSE_SCHEMAS,
  MealList: {
    type: 'array',
    items: { $ref: '#/components/schemas/Meal' },
    description: 'Meals for the requested day.',
  },
};
