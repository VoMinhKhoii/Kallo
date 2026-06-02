import { z } from 'zod';
import { Errors, serializeError } from '@/lib/errors';

/**
 * Convert a thrown value into an API error response for `/api/v1/*` route
 * handlers.
 *
 * - `ZodError` (request body / query validation) → 400 `VALIDATION_FAILED`
 *   so malformed mobile requests surface as a client error, not a 500.
 * - `AppError` / anything else → delegated to `serializeError`
 *   (structured JSON for known errors, generic 500 otherwise).
 *
 * The resulting envelope is always `{ error: { code, status, retryable,
 * message } }`, which `parseApiError` (lib/errors.ts) on the client reads.
 */
export function handleRouteError(error: unknown) {
  if (error instanceof z.ZodError) {
    const message = error.issues[0]?.message ?? 'Invalid request.';
    return serializeError(Errors.validationFailed(message));
  }
  return serializeError(error);
}
