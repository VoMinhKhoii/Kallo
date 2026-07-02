/**
 * Contract for the barcode REST surface (`/api/v1/barcode/*`).
 *
 * Imported by mobile clients, so this file must NEVER value-import a server
 * action or any 'server-only'/db/supabase module. It contains only:
 *   - Zod request schemas depending solely on 'zod' and pure modules.
 *   - `export type` re-exports (erased at runtime).
 */
import { z } from 'zod';
import { MAX_FOOD_ITEM_GRAMS } from '@/lib/barcode/constants';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

const barcodeSchema = z
  .string()
  .min(1, 'Mã vạch không được để trống')
  .max(64)
  .regex(/^\d+$/, 'Mã vạch chỉ được chứa số');

/** Query for `GET /api/v1/barcode/search?code=<digits>`. */
export const barcodeSearchQuerySchema = z.object({
  code: barcodeSchema,
});

export type BarcodeSearchQuery = z.infer<typeof barcodeSearchQuerySchema>;

/**
 * Request body for `POST /api/v1/barcode/log`.
 *
 * Stages the (previously searched, hence cached) product scaled to `grams`
 * AND confirms it server-side in one call — the flow has no user step between
 * stage and confirm, so a single round trip avoids the orphaned-pending
 * partial-failure mode of a two-call sequence. `mealId` is the optional
 * client-generated id, as in `/api/v1/meals/confirm`.
 */
export const logBarcodeMealSchema = z.object({
  barcode: barcodeSchema,
  grams: z
    .number()
    .positive('Khối lượng phải lớn hơn 0')
    .finite()
    .max(MAX_FOOD_ITEM_GRAMS, 'Khối lượng quá lớn'),
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export type LogBarcodeMealInput = z.infer<typeof logBarcodeMealSchema>;

export type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';
export type { BarcodeErrorCode } from '@/lib/barcode/types';
