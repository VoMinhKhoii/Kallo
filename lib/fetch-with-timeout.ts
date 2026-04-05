import { Errors } from '@/lib/errors';

/**
 * Wrap an async operation with a timeout.
 *
 * **Important**: This is intended for `fetch` calls and other abort-aware
 * operations. Do NOT use for database queries — `postgres.js` has no
 * `AbortSignal` support, so the underlying query continues running even
 * after the timeout fires.
 *
 * @param fn      — Async function to execute. Receives an `AbortSignal`
 *                  that callers can forward to `fetch()`.
 * @param timeoutMs — Maximum time in ms before the operation is aborted.
 * @param label   — Human-readable label for logging / debugging.
 */
export async function fetchWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  _label: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await fn(controller.signal);
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw Errors.pipelineTimeout();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
