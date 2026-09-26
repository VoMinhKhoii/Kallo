/**
 * Contract for the nutrition-label OCR REST surface
 * (`/api/v1/nutrition-label/*`).
 *
 * Imported by mobile clients, so this file must NEVER value-import a server
 * action or any 'server-only'/db/supabase module. It contains only:
 *   - Zod request schemas depending solely on 'zod' and pure modules.
 *   - `export type` re-exports (erased at runtime).
 *
 * These are the same schemas the web Server Actions in
 * `lib/actions/nutrition-ocr.ts` validate against — declared here so the
 * route handlers and the actions cannot drift apart.
 */
import { z } from 'zod';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import {
  OCR_MAX_IMAGE_BYTES,
  OCR_UPLOAD_MIME_TYPES,
} from '@/lib/domain/nutrition/ocr/image-constants';
import {
  nutritionValuesSchema,
  ocrConfidenceSchema,
} from '@/lib/domain/nutrition/ocr/schema';

/**
 * Body for `POST /api/v1/nutrition-label/scan` — a base64 label photo the
 * server hands to the vision model.
 *
 * The base64 is checked for shape AND decoded size up front so an oversized
 * payload is rejected before `Buffer.from` allocates it. Magic-byte
 * verification (that the declared mime really is the bytes) happens
 * server-side in `validateNutritionLabelImage`.
 */
export const scanNutritionLabelSchema = z.object({
  imageBase64: z
    .string()
    .min(1, 'Image data is required')
    .refine(
      (value) => value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value),
      'Malformed base64 image data'
    )
    .refine((value) => {
      const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
      return (value.length * 3) / 4 - padding <= OCR_MAX_IMAGE_BYTES;
    }, 'Image payload is too large'),
  mimeType: z.enum(OCR_UPLOAD_MIME_TYPES),
});

export type ScanNutritionLabelInput = z.infer<typeof scanNutritionLabelSchema>;

/** A stored label photo's id: the scan reply's `labelImageId`, and the path
 *  id of `GET /api/v1/nutrition-label/images/{imageId}`. */
export const labelImageIdSchema = z.string().uuid();

/**
 * Body for `POST /api/v1/nutrition-label/log` — the user-reviewed values from
 * the label, staged AND confirmed in one call.
 *
 * Like the barcode flow, review→save has no intermediate user step, so a
 * single round trip avoids the orphaned-pending partial-failure mode. Calories
 * and the three macros are unwrapped from nullable: the review step will not
 * submit without them.
 *
 * The micronutrients are spread from `.partial()`, so a client may omit the
 * ones the label never printed instead of sending two dozen explicit nulls.
 * Staging reads them as `?? null` either way. The web review step still sends
 * the full set, which this accepts unchanged.
 */
export const logNutritionLabelMealSchema = z.object({
  productName: z.string().min(1).max(200),
  amount: z.number().finite().positive().max(100_000),
  unit: z.enum(['g', 'ml', 'serving']),
  confidence: ocrConfidenceSchema,
  ...nutritionValuesSchema.partial().shape,
  calories: nutritionValuesSchema.shape.calories.unwrap(),
  proteinGrams: nutritionValuesSchema.shape.proteinGrams.unwrap(),
  carbsGrams: nutritionValuesSchema.shape.carbsGrams.unwrap(),
  fatGrams: nutritionValuesSchema.shape.fatGrams.unwrap(),
  /** Client-generated id, as in `/api/v1/meals/confirm`. */
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  /**
   * The `labelImageId` the scan returned. The stored photo is linked to the
   * saved meal when it belongs to the caller; any other id is ignored.
   */
  labelImageId: labelImageIdSchema.optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/** Reply of `GET /api/v1/nutrition-label/images/{imageId}`. */
export const labelImageUrlSchema = z.object({
  /** Signed Storage URL; stops working at `expiresAt`. */
  url: z.string().url(),
  /** ISO-8601 instant, about ten minutes after the request. */
  expiresAt: z.string().datetime(),
});

export type LabelImageUrl = z.infer<typeof labelImageUrlSchema>;

export type LogNutritionLabelMealInput = z.infer<
  typeof logNutritionLabelMealSchema
>;

export type {
  OcrConfidence,
  OcrErrorCode,
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
