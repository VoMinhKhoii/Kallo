import { isAppError } from '@/lib/errors';

interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Default: 1000 */
  baseDelayMs?: number;
  /** Custom predicate to decide if an error is retriable. */
  isRetriable?: (error: unknown) => boolean;
}

/**
 * Retry an async function with exponential backoff and jitter.
 *
 * **WARNING**: Only use for **reads and idempotent operations**.
 * Non-idempotent writes (e.g. inserts) should NOT be retried
 * because the first attempt may have succeeded silently.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const isRetriable = options?.isRetriable ?? defaultIsRetriable;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetriable(error)) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random());
      await sleep(delay);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}

function defaultIsRetriable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryable;
  }
  // Network errors, timeouts, and unknown errors are retriable by default
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
