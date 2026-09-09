/**
 * The barcode flow's domain error and its HTTP/user-facing mapping.
 *
 * Split out of `service.ts` (which reaches the DB and the provider chain) so
 * every surface that only needs to CLASSIFY a barcode failure — the composer's
 * pick resolver, the analyze-meal pre-stream check, the `/api/v1` routes — can
 * import it without pulling a fetch chain in behind it. Depends on `lib/core`
 * only.
 */
import { AppError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import type { BarcodeErrorCode } from '@/lib/domain/barcode/types';

/**
 * Domain failure in the barcode flow, carrying a stable {@link BarcodeErrorCode}.
 *
 * The service THROWS instead of returning `{success:false}` unions so that
 * callers choose their own error transport: server actions catch and fold into
 * their result union (web dialog contract), while `/api/v1/barcode/*` routes
 * map codes onto the standard `{error:{code,status,...}}` envelope with real
 * HTTP statuses. Crucially this keeps auth/validation failures OUT of the
 * domain-error path — an expired mobile token must surface as a 401, not as a
 * `server_error` inside an HTTP 200.
 */
export class BarcodeServiceError extends Error {
  /**
   * Copy meant for the person looking at the screen, when the thrower has
   * surface-specific wording (the composer's rescan prompt). Absent — as it is
   * for every service-level throw — {@link mapBarcodeServiceError} uses its own
   * default for the code, so the REST envelope is unchanged.
   */
  readonly userMessage?: string;

  constructor(
    public readonly code: Exclude<BarcodeErrorCode, 'invalid_input'>,
    message?: string
  ) {
    super(message ?? `Barcode flow failed: ${code}`);
    this.name = 'BarcodeServiceError';
    this.userMessage = message;
  }
}

/**
 * What the composer tells a user whose scanned product is no longer cached.
 * Vietnamese because the web composer renders this string verbatim (in the SSE
 * error frame and the staging toast); the `/api/v1` clients localize by CODE.
 */
export const BARCODE_RESCAN_MESSAGE =
  'Không tìm thấy sản phẩm đã quét. Hãy quét lại.';

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
        error.userMessage ?? 'No product found for this barcode.'
      );
    case 'not_cached':
      return new AppError(
        'BARCODE_NOT_CACHED',
        404,
        false,
        error.userMessage ??
          'Barcode must be searched before logging. Please rescan.'
      );
    default:
      return Errors.internal(error);
  }
}
