// ---------------------------------------------------------------------------
// Browser edge — read the wire envelope back into an error object.
//
// Deliberately free of `next/server` and of the server-side AppError
// hierarchy: this is the only errors module a client component may import.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/**
 * Parse the `{ error: { code, status, retryable, message } }` shape
 * returned by `serializeError` into an `ApiError` instance.
 */
export function parseApiError(body: unknown): ApiError {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as Record<string, unknown>).error === 'object'
  ) {
    const err = (body as { error: Record<string, unknown> }).error;
    return new ApiError(
      typeof err.code === 'string' ? err.code : 'UNKNOWN',
      typeof err.status === 'number' ? err.status : 500,
      typeof err.retryable === 'boolean' ? err.retryable : false
    );
  }
  return new ApiError('UNKNOWN', 500, false);
}
