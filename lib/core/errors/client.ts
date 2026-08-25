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
    public readonly retryable: boolean,
    // The server's user-facing message. Optional and trailing so every
    // existing 3-argument construction keeps compiling. `Error.message` still
    // falls back to `code` when the envelope carried none.
    public readonly serverMessage?: string,
    // The stable, status-driven next step from `resolutionFor`. Machine-
    // actionable where `serverMessage` is prose, so an agent can decide what
    // to do without parsing the human copy.
    public readonly resolution?: string,
    // Only present on a `FeatureLockedError` envelope (402): which feature was
    // locked and why — what the client keys the paywall on.
    public readonly feature?: string,
    public readonly reason?: string
  ) {
    super(serverMessage ?? code);
    this.name = 'ApiError';
  }
}

/**
 * Parse the `{ error: { code, status, retryable, message, resolution } }`
 * shape returned by `serializeError` into an `ApiError` instance. A 402
 * envelope additionally carries `feature` + `reason` (see `FeatureLockedError`).
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
      typeof err.retryable === 'boolean' ? err.retryable : false,
      typeof err.message === 'string' ? err.message : undefined,
      typeof err.resolution === 'string' ? err.resolution : undefined,
      typeof err.feature === 'string' ? err.feature : undefined,
      typeof err.reason === 'string' ? err.reason : undefined
    );
  }
  return new ApiError('UNKNOWN', 500, false);
}
