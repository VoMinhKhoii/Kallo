/**
 * Stable, locale-agnostic error codes for the barcode flow. Clients map them
 * to a localized message (web: `t('barcodeError.<code>')`; mobile:
 * `logging.barcode.error.*`). Server-side text is never returned directly, so
 * error copy honors the user's locale.
 *
 * Lives in a dependency-light module (like `constants.ts`) so contracts and
 * clients can import it without pulling in server-only code.
 */
export type BarcodeErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'not_cached'
  | 'stage_failed'
  | 'rate_limited'
  | 'server_error';

/**
 * Identifier for a barcode lookup source. Doubles as the key for its cache
 * prefix (`lib/domain/barcode/cache.ts`) and its chain descriptor
 * (`lib/domain/barcode/chain.ts`).
 */
export type BarcodeProviderId = 'usda_fdc' | 'off';

/**
 * A barcode product as every provider adapter and the cache-read path return
 * it: per-100g nutrition plus optional sizing. Mirrored field-for-field by the
 * Flutter client (`apps/mobile-flutter/lib/models/nutrition/barcode_product.dart`) and
 * re-exported by the REST contract, so the field set is a cross-client
 * contract — adding or renaming a field breaks mobile.
 */
export interface ParsedBarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  /** Grams per serving, if the provider gives a plausible value. */
  servingSizeG: number | null;
  /** Grams in the whole package (net quantity), if plausible. */
  packageSizeG: number | null;
}
