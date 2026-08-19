'use server';

import { z } from 'zod';
import { barcodeSchema } from '@/lib/api/contracts/barcode';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import { MAX_FOOD_ITEM_GRAMS } from '@/lib/domain/barcode/constants';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/openfoodfacts';
import {
  BarcodeServiceError,
  searchBarcodeProduct,
  stageBarcodeMeal,
} from '@/lib/domain/barcode/service';
import type { BarcodeErrorCode } from '@/lib/domain/barcode/types';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export type { BarcodeErrorCode } from '@/lib/domain/barcode/types';

const searchBarcodeSchema = z.object({
  barcode: barcodeSchema,
});

const stageBarcodeMealSchema = z.object({
  barcode: barcodeSchema,
  grams: z
    .number()
    .positive('Khối lượng phải lớn hơn 0')
    .max(MAX_FOOD_ITEM_GRAMS, 'Khối lượng quá lớn'),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/** Fold a thrown value into the action result union's stable error code. */
function getErrorCode(error: unknown): BarcodeErrorCode {
  if (error instanceof BarcodeServiceError) return error.code;
  return error instanceof z.ZodError ? 'invalid_input' : 'server_error';
}

/**
 * Search for a product by barcode. If not in DB, fetches from Open Food Facts API
 * and caches it in vietnamese_food_composition.
 *
 * Thin wrapper over `lib/barcode/service.ts` (shared with the `/api/v1/barcode`
 * routes) preserving the web dialog's `{success, code}` result contract.
 */
export async function searchBarcodeAction(input: {
  barcode: string;
}): Promise<
  | { success: true; data: ParsedBarcodeProduct }
  | { success: false; code: BarcodeErrorCode }
> {
  try {
    const parsed = searchBarcodeSchema.parse(input);
    await requireAuthAndProfile();
    const data = await searchBarcodeProduct(parsed.barcode);
    return { success: true, data };
  } catch (error) {
    console.error('Error in searchBarcodeAction:', error);
    return { success: false, code: getErrorCode(error) };
  }
}

/**
 * Scales the nutrition values for a barcode product and stages it in pending_analyses.
 *
 * Thin wrapper over `lib/barcode/service.ts` (shared with the `/api/v1/barcode`
 * routes) preserving the web dialog's `{success, code}` result contract.
 */
export async function stageBarcodeMealAction(input: {
  barcode: string;
  grams: number;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<
  | { success: true; analysisId: string }
  | { success: false; code: BarcodeErrorCode }
> {
  try {
    const parsed = stageBarcodeMealSchema.parse(input);
    const { user } = await requireAuthAndProfile();
    const { analysisId } = await stageBarcodeMeal(user.id, parsed);
    return { success: true, analysisId };
  } catch (error) {
    console.error('Error in stageBarcodeMealAction:', error);
    return { success: false, code: getErrorCode(error) };
  }
}
