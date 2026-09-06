'use server';

import { z } from 'zod';
import { barcodeSchema } from '@/lib/api/contracts/barcode';
import { RateLimitedError } from '@/lib/core/errors/app-error';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import { MAX_FOOD_ITEM_GRAMS } from '@/lib/domain/barcode/constants';
import {
  BarcodeServiceError,
  searchBarcodeProduct,
  stageBarcodeMeal,
} from '@/lib/domain/barcode/service';
import type {
  BarcodeErrorCode,
  ParsedBarcodeProduct,
} from '@/lib/domain/barcode/types';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

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

/** The failure arm of both actions' result union. */
type BarcodeActionFailure = {
  success: false;
  code: BarcodeErrorCode;
  /**
   * How long to wait, when the failure was a limiter block. A Server Action
   * has no response headers, so `Retry-After` has nowhere to go — without this
   * field the dialog knows to say "slow down" but not for how long, and a
   * client that guesses low walks straight back into the same wall.
   */
  retryAfterSeconds?: number;
};

/** Fold a thrown value into the action result union's stable error code. */
function getErrorCode(error: unknown): BarcodeErrorCode {
  if (error instanceof BarcodeServiceError) return error.code;
  // A limiter block reaches the web caller as a return value, not an HTTP 429
  // (this is a Server Action). Surfacing it as its own code lets the dialog
  // show the "slow down" copy instead of a generic "server error".
  if (error instanceof RateLimitedError) return 'rate_limited';
  return error instanceof z.ZodError ? 'invalid_input' : 'server_error';
}

function toFailure(error: unknown): BarcodeActionFailure {
  const code = getErrorCode(error);
  return error instanceof RateLimitedError && error.retryAfterSeconds != null
    ? { success: false, code, retryAfterSeconds: error.retryAfterSeconds }
    : { success: false, code };
}

/**
 * Search for a product by barcode. If not in DB, fetches from Open Food Facts API
 * and caches it in vietnamese_food_composition.
 *
 * Thin wrapper over `lib/domain/barcode/service.ts` (shared with the `/api/v1/barcode`
 * routes) preserving the web dialog's `{success, code}` result contract.
 */
export async function searchBarcodeAction(input: {
  barcode: string;
}): Promise<
  { success: true; data: ParsedBarcodeProduct } | BarcodeActionFailure
> {
  try {
    const parsed = searchBarcodeSchema.parse(input);
    const { user } = await requireAuthAndProfile();
    // Per-user cap before the Open Food Facts fan-out. `RateLimitedError`
    // surfaces below as the `rate_limited` code.
    await assertRateLimit('barcodeSearch', { kind: 'user', value: user.id });
    const data = await searchBarcodeProduct(parsed.barcode);
    return { success: true, data };
  } catch (error) {
    console.error('Error in searchBarcodeAction:', error);
    return toFailure(error);
  }
}

/**
 * Scales the nutrition values for a barcode product and stages it in pending_analyses.
 *
 * Thin wrapper over `lib/domain/barcode/service.ts` (shared with the `/api/v1/barcode`
 * routes) preserving the web dialog's `{success, code}` result contract.
 */
export async function stageBarcodeMealAction(input: {
  barcode: string;
  grams: number;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<{ success: true; analysisId: string } | BarcodeActionFailure> {
  try {
    const parsed = stageBarcodeMealSchema.parse(input);
    const { user } = await requireAuthAndProfile();
    const { analysisId } = await stageBarcodeMeal(user.id, parsed);
    return { success: true, analysisId };
  } catch (error) {
    console.error('Error in stageBarcodeMealAction:', error);
    return toFailure(error);
  }
}
