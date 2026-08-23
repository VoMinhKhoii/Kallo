import { logBarcodeMealSchema } from '@/lib/api/contracts/barcode';
import {
  authed,
  dateParam,
  fromZod,
  limitParam,
  type Parameter,
  type PathItem,
  ref,
  tzParam,
} from '@/lib/api/openapi/components';

const TAGS = ['Logging'];

const codeParam: Parameter = {
  name: 'code',
  in: 'query',
  required: true,
  description: 'The barcode digits as scanned (EAN-8, EAN-13 or UPC-A).',
  schema: { type: 'string' },
};

/** The day view, and the two non-AI ways of getting food into it. */
export const LOGGING_PATHS: Record<string, PathItem> = {
  '/api/v1/logging/day': {
    get: authed({
      operationId: 'getLoggingDay',
      summary: 'One day of logging',
      description:
        'Meals, totals and targets for a single calendar day — everything the logging screen renders in one request.',
      tags: TAGS,
      parameters: [dateParam, tzParam],
      ok: ref('LoggingDay'),
    }),
  },

  '/api/v1/ingredients/search': {
    get: authed({
      operationId: 'searchIngredients',
      summary: 'Search the food-composition tables',
      description:
        'Full-text search over the reference data behind every estimate: the Vietnam National Food Composition Table 2007, plus FAO and USDA. Results are per-100g composition rows, not user data. This is the lookup step of manual logging.',
      tags: [...TAGS, 'Reference data'],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          description:
            'Search text. Vietnamese diacritics are significant and are not stripped.',
          schema: { type: 'string', minLength: 1 },
        },
        limitParam(50, 'How many matches to return.'),
      ],
      ok: ref('IngredientSearchResults'),
    }),
  },

  '/api/v1/barcode/search': {
    get: authed({
      operationId: 'searchBarcode',
      summary: 'Look up a packaged product by barcode',
      description:
        'Resolves a scanned barcode to a product and its label figures. Returns 404 when the code is not in the database — nothing is invented for an unknown product.',
      tags: TAGS,
      parameters: [codeParam],
      ok: ref('Acknowledgement'),
      okDescription: 'The matched product and its per-serving nutrition.',
    }),
  },

  '/api/v1/barcode/log': {
    post: authed({
      operationId: 'logBarcodeMeal',
      summary: 'Log a scanned product',
      description:
        'Saves a barcode match as a meal. Figures come straight from the product label, so no estimation is involved.',
      tags: TAGS,
      body: fromZod(logBarcodeMealSchema),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },
};
