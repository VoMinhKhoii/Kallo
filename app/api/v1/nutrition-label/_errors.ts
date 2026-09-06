import {
  AppError,
  PayloadTooLargeError,
  RateLimitedError,
  RateLimitUnavailableError,
} from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { scanErrorCode } from '@/lib/domain/nutrition/ocr/error';

/**
 * How long to wait when the provider said "429" but not "for how long". A
 * client that guesses its own back-off hammers a service that is already
 * shedding, so 30s is the deliberate floor rather than no header at all.
 */
const PROVIDER_RETRY_AFTER_FALLBACK_SECONDS = 30;

/**
 * The provider's own retry hint, in seconds, if it sent one we can read.
 *
 * Two spellings are worth handling: an HTTP `Retry-After` (seconds, on the
 * response headers a client library usually attaches to the error) and
 * Google's `RetryInfo.retryDelay`, which is a duration string like `"27s"`.
 * Anything else — a date-form `Retry-After`, a nested detail we do not
 * recognise — falls through to the conservative default rather than being
 * guessed at.
 */
function providerRetryAfterSeconds(error: unknown): number {
  const candidate = error as {
    retryAfterSeconds?: unknown;
    retryDelay?: unknown;
    headers?: { get?: (name: string) => string | null };
  } | null;

  const raw =
    candidate?.retryAfterSeconds ??
    candidate?.retryDelay ??
    candidate?.headers?.get?.('retry-after');

  const seconds =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw.replace(/s$/, ''))
        : Number.NaN;

  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : PROVIDER_RETRY_AFTER_FALLBACK_SECONDS;
}

/**
 * Map anything thrown by the label-scan path onto the standard `/api/v1`
 * error envelope with a real HTTP status. Domain codes get `OCR_*` codes (the
 * Flutter client maps them to localized copy).
 *
 * Anything not recognized as an OCR domain failure is returned UNTOUCHED so
 * `handleRouteError` can classify it — a `ZodError` must still surface as a
 * 400 `VALIDATION_FAILED`, not as a generic 500. Same contract as
 * `app/api/v1/barcode/_errors.ts`. The classification itself lives in
 * `lib/domain/nutrition/ocr/error.ts` so the web Server Action agrees with us.
 */
export function mapNutritionLabelError(error: unknown): unknown {
  // Errors that already carry the right status, the retryable flag and (for the
  // limiter's two) a `Retry-After`. Passed through UNTOUCHED: re-wrapping the
  // 429 as `OCR_RATE_LIMITED` would drop the header, and a body that blew its
  // cap is a 413 whose whole point is that it is NOT retryable — `scanErrorCode`
  // does not model either, so it would fold all three into `server_error`.
  if (
    error instanceof RateLimitedError ||
    error instanceof RateLimitUnavailableError ||
    error instanceof PayloadTooLargeError
  ) {
    return error;
  }

  switch (scanErrorCode(error)) {
    case 'invalid_image':
      return new AppError(
        'OCR_INVALID_IMAGE',
        400,
        false,
        'The image could not be read as a nutrition label photo.'
      );
    case 'no_label_detected':
      return new AppError(
        'OCR_NO_LABEL_DETECTED',
        422,
        false,
        'No printed nutrition table was found in this photo.'
      );
    // The provider is over ITS quota. A `RateLimitedError` rather than a plain
    // `AppError` so `serializeError` emits `Retry-After`, preserving the
    // provider's own hint when it sent one: a 429 with no header tells the
    // client to back off but not for how long, so it guesses — and a client
    // that guesses low re-enters the same wall immediately.
    case 'rate_limited':
      return Errors.rateLimited(
        'The label scanner is busy. Please try again in a moment.',
        providerRetryAfterSeconds(error)
      );
    default:
      return error;
  }
}
