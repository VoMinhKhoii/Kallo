import { candidatesSchema } from '@/lib/api/contracts/nutrition';
import {
  logNutritionLabelMealSchema,
  scanNutritionLabelSchema,
} from '@/lib/api/contracts/nutrition-label';
import {
  authed,
  fromZod,
  type PathItem,
  ref,
  tzParam,
} from '@/lib/api/openapi/components';

const TAGS = ['Nutrition'];

/** Micronutrients over time, and reading a nutrition label from a photo. */
export const NUTRITION_PATHS: Record<string, PathItem> = {
  '/api/v1/nutrition/overview': {
    get: authed({
      operationId: 'getNutritionOverview',
      summary: 'Micronutrient intake over a range',
      description:
        'Per-nutrient intake against the reference target, with the data-coverage figure behind each one — the share of logged grams that had a value for that nutrient. A high intake on low coverage is not a high intake, and the payload says so rather than hiding it.',
      tags: TAGS,
      parameters: [
        {
          name: 'range',
          in: 'query',
          required: true,
          description:
            '`auto` picks the widest range with enough data. The rest are fixed windows.',
          schema: { type: 'string', enum: ['auto', '7d', '30d', '90d'] },
        },
        tzParam,
        {
          name: 'days',
          in: 'query',
          required: false,
          description:
            'Which days count toward the averages. `complete` uses only fully logged days; `all` uses every day in the range.',
          schema: { type: 'string', enum: ['all', 'complete'] },
        },
      ],
      ok: ref('NutritionOverview'),
    }),
  },

  '/api/v1/nutrition/candidates': {
    post: authed({
      operationId: 'getNutrientFoodSources',
      summary: 'Foods that supply a given nutrient',
      description:
        'Suggests foods high in one nutrient, drawn from the composition tables, with the per-100g amount for each. Answers "what should I eat more of" without inventing a recommendation.',
      tags: [...TAGS, 'Reference data'],
      body: fromZod(candidatesSchema),
      ok: ref('Acknowledgement'),
      okDescription: 'Candidate foods, each with its per-100g amount and unit.',
    }),
  },

  '/api/v1/nutrition-label/scan': {
    post: authed({
      operationId: 'scanNutritionLabel',
      summary: 'Read a nutrition label from an image',
      description:
        'OCR over a photographed nutrition label. Read-only: it returns what it read and writes nothing. Returns 422 with `OCR_NO_LABEL_DETECTED` when the image contains no label it can parse — which is a normal outcome, not an error to retry blindly.',
      tags: TAGS,
      body: fromZod(scanNutritionLabelSchema),
      bodyDescription: 'Base64-encoded image bytes.',
      ok: ref('Acknowledgement'),
      okDescription: 'The parsed label figures.',
    }),
  },

  '/api/v1/nutrition-label/log': {
    post: authed({
      operationId: 'logNutritionLabelMeal',
      summary: 'Log a meal from scanned label figures',
      description:
        'Saves the result of a label scan — after the user has confirmed or corrected it — as a meal.',
      tags: TAGS,
      body: fromZod(logNutritionLabelMealSchema),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },
};
