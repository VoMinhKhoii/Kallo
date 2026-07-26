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
  | 'server_error';

/**
 * Identifier for a barcode lookup source. Doubles as the key for its cache
 * prefix (`lib/barcode/cache.ts`) and its chain descriptor
 * (`lib/barcode/chain.ts`).
 */
export type BarcodeProviderId = 'usda_fdc' | 'off';
