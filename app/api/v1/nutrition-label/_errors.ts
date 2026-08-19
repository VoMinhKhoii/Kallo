import { AppError } from '@/lib/core/errors/app-error';
import { scanErrorCode } from '@/lib/domain/nutrition/ocr/error';

/**
 * Map anything thrown by the label-scan path onto the standard `/api/v1`
 * error envelope with a real HTTP status. Domain codes get `OCR_*` codes (the
 * Flutter client maps them to localized copy).
 *
 * Anything not recognized as an OCR domain failure is returned UNTOUCHED so
 * `handleRouteError` can classify it — a `ZodError` must still surface as a
 * 400 `VALIDATION_FAILED`, not as a generic 500. Same contract as
 * `app/api/v1/barcode/_errors.ts`. The classification itself lives in
 * `lib/nutrition/ocr-error.ts` so the web Server Action agrees with us.
 */
export function mapNutritionLabelError(error: unknown): unknown {
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
    case 'rate_limited':
      return new AppError(
        'OCR_RATE_LIMITED',
        429,
        true,
        'The label scanner is busy. Please try again in a moment.'
      );
    default:
      return error;
  }
}
