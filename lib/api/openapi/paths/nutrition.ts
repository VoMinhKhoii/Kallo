import { candidatesSchema } from '@/lib/api/contracts/nutrition';
import {
  labelImageUrlSchema,
  logNutritionLabelMealSchema,
  scanNutritionLabelSchema,
} from '@/lib/api/contracts/nutrition-label';
import {
  AI_CONSENT_REQUIRED_ERROR,
  authed,
  fromZod,
  MEAL_ID_CONFLICT_ERROR,
  optionalTzParam,
  PAYLOAD_TOO_LARGE_ERROR,
  type PathItem,
  pathParam,
  RATE_LIMITER_UNAVAILABLE_ERROR,
  ref,
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
        optionalTzParam,
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
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
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
        'OCR over a photographed nutrition label. Logs no meal: it returns what it read. Once the image passes validation, the photo and the scan outcome (what was read, or the failure) are kept in private storage linked to the account — readable only by its owner and the Kallo team (OCR quality work) — until the account is deleted. The stored copy is re-encoded without its metadata (EXIF, including GPS). Keeping them is best-effort and never changes this reply; when the photo and its record are already stored, the reply carries `labelImageId`, which the client passes back to `/log`. Returns 422 with `OCR_NO_LABEL_DETECTED` when the image contains no label it can parse — which is a normal outcome, not an error to retry blindly.',
      tags: TAGS,
      body: fromZod(scanNutritionLabelSchema),
      bodyDescription: 'Base64-encoded image bytes.',
      ok: ref('Acknowledgement'),
      okDescription:
        '`{ label, labelImageId? }` — the parsed label figures, and the id of the kept photo when it and its record were stored before the reply.',
      // OCR is spend-gated (`withOcrGuard`): the global Gemini budget fails
      // closed, so this op alone can answer 503 when the limiter is down. The
      // shared 429 (per-user / concurrency block) is already in COMMON_ERRORS.
      extraErrors: {
        ...PAYLOAD_TOO_LARGE_ERROR,
        ...RATE_LIMITER_UNAVAILABLE_ERROR,
        ...AI_CONSENT_REQUIRED_ERROR,
      },
    }),
  },

  '/api/v1/nutrition-label/log': {
    post: authed({
      operationId: 'logNutritionLabelMeal',
      summary: 'Log a meal from scanned label figures',
      description:
        'Saves the result of a label scan — after the user has confirmed or corrected it — as a meal. An optional `labelImageId` from the scan links the kept photo to the saved meal; an id that is not the caller’s is ignored.',
      tags: TAGS,
      extraErrors: { ...PAYLOAD_TOO_LARGE_ERROR, ...MEAL_ID_CONFLICT_ERROR },
      body: fromZod(logNutritionLabelMealSchema),
      ok: ref('MealWriteResult'),
    }),
  },

  '/api/v1/nutrition-label/images/{imageId}': {
    get: authed({
      operationId: 'getNutritionLabelImageUrl',
      summary: 'View a kept label photo',
      description:
        'A short-lived (10-minute) signed URL for one of the caller’s own kept label photos. Another user’s id, an unknown id and a malformed one are all 404 `NOT_FOUND`.',
      tags: TAGS,
      parameters: [
        pathParam('imageId', 'The `labelImageId` the scan returned (UUID).'),
      ],
      ok: fromZod(labelImageUrlSchema),
      okDescription: 'The signed URL and the instant it stops working.',
    }),
  },
};
