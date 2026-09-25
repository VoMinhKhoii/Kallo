/**
 * Every `code` an API error envelope can carry.
 *
 * The published OpenAPI `Error` schema takes its `code` enum from this list, and
 * `__tests__/codes.test.ts` scans the source for every `AppError` code literal
 * and fails if one is missing here — so a new code cannot ship without the spec
 * learning about it.
 */
export const ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'PROFILE_NOT_FOUND',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'CIRCLE_LIMIT_REACHED',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'RATE_LIMITER_UNAVAILABLE',
  'PIPELINE_TIMEOUT',
  'feature_locked',
  'ai_consent_required',
  'INTERNAL',
  'BARCODE_NOT_FOUND',
  'BARCODE_NOT_CACHED',
  'OCR_INVALID_IMAGE',
  'OCR_NO_LABEL_DETECTED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
