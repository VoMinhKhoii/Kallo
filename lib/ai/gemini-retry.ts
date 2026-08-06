export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

function getErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const statusMatch = error.message.match(/\b(408|429|500|502|503|504)\b/);
  if (statusMatch) {
    return Number.parseInt(statusMatch[1], 10);
  }

  if (error.message.includes('UNAVAILABLE')) {
    return 503;
  }

  return null;
}

function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }

  // Schema-validation failures ARE retryable: the model is nondeterministic,
  // so a re-ask usually produces a conforming response. This is load-bearing
  // for the required macro triples (and `grams.positive()`) — without it, one
  // malformed emission failed the whole call on attempt 1, despite schemas-v2
  // having long claimed the parse "routes into the withRetry retry path".
  // Matched by name rather than `instanceof z.ZodError` so this module stays
  // free of a zod import.
  if (error instanceof Error && error.name === 'ZodError') {
    return true;
  }

  const status = getErrorStatus(error);
  if (status != null) {
    return new Set([408, 429, 500, 502, 503, 504]).has(status);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /fetch failed|network error|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(
    error.message
  );
}

/**
 * Compute the retry backoff for the next attempt.
 *
 * Priority order:
 *   1. Honor `retry in Xs` hints in the error message (Gemini 429 quota).
 *   2. **5xx fast recovery (Phase C6)**: if the previous attempt aborted in
 *      under `FAST_RECOVERY_THRESHOLD_MS` with a 5xx/UNAVAILABLE, drop to a
 *      250 ms floor instead of the 1000 ms exponential start. Only applies to
 *      the first retry (attempt=2); subsequent retries use full exponential.
 *      This shaves ~750 ms off transient provider-pressure recovery.
 *   3. Standard exponential: baseDelayMs * 2^(attempt-1).
 */
const FAST_RECOVERY_THRESHOLD_MS = 5000;
const FAST_RECOVERY_DELAY_MS = 250;
function parseRetryDelay(
  error: Error,
  baseDelayMs: number,
  attempt: number,
  status: number | null,
  attemptElapsedMs: number
): number {
  const match = error.message.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Number.parseFloat(match[1]) * 1000;
  }
  const isFastRecoverableStatus =
    status === 500 || status === 502 || status === 503 || status === 504;
  if (
    attempt === 1 &&
    isFastRecoverableStatus &&
    attemptElapsedMs < FAST_RECOVERY_THRESHOLD_MS
  ) {
    return FAST_RECOVERY_DELAY_MS;
  }
  return baseDelayMs * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type WithRetry = ReturnType<typeof createWithRetry>;

/** Shared exponential-backoff retry loop for every Gemini call. */
export function createWithRetry(retry: RetryOptions) {
  return async function withRetry<T>(
    fn: (attempt: number) => Promise<T>,
    opts?: {
      label?: string;
      onAttempt?: (
        attempt: number,
        t0: number,
        result: T | null,
        err: unknown
      ) => void;
    }
  ): Promise<T> {
    const label = opts?.label;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retry.maxRetries; attempt++) {
      const t0 = Date.now();
      try {
        const result = await fn(attempt);
        console.info(
          `[gemini] ${label ?? 'call'} attempt ${attempt}/${retry.maxRetries}: ${Date.now() - t0}ms`
        );
        opts?.onAttempt?.(attempt, t0, result, null);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const elapsed = Date.now() - t0;
        const status = getErrorStatus(lastError);
        opts?.onAttempt?.(attempt, t0, null, err);

        if (
          !isRetryableGeminiError(lastError) ||
          attempt === retry.maxRetries
        ) {
          console.error(
            `[gemini] ${label ?? 'call'} attempt ${attempt}/${retry.maxRetries} failed (${elapsed}ms): ${lastError.message}`
          );
          throw lastError;
        }

        const delay = parseRetryDelay(
          lastError,
          retry.baseDelayMs,
          attempt,
          status,
          elapsed
        );
        console.warn(
          `[gemini] ${label ?? 'call'} attempt ${attempt}/${retry.maxRetries} got retryable ${status ?? 'error'} (${elapsed}ms), retrying in ${delay}ms`
        );
        await sleep(delay);
      }
    }

    throw lastError;
  };
}
