import { BarcodeServiceError } from '@/lib/barcode/service';
import { AppError, Errors } from '@/lib/errors';

/**
 * Map a {@link BarcodeServiceError} onto the standard `/api/v1` error envelope
 * with a real HTTP status. Domain codes get barcode-specific `BARCODE_*`
 * codes (the Flutter client maps them to localized copy); infrastructure
 * failures fall through to the generic 500.
 *
 * Returns the original value untouched when it isn't a BarcodeServiceError so
 * callers can rethrow into `handleRouteError`.
 */
export function mapBarcodeServiceError(error: unknown): unknown {
  if (!(error instanceof BarcodeServiceError)) return error;
  switch (error.code) {
    case 'not_found':
      return new AppError(
        'BARCODE_NOT_FOUND',
        404,
        false,
        'No product found for this barcode.'
      );
    case 'not_cached':
      return new AppError(
        'BARCODE_NOT_CACHED',
        404,
        false,
        'Barcode must be searched before logging. Please rescan.'
      );
    default:
      return Errors.internal(error);
  }
}
