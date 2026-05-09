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
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const operation = Promise.resolve().then(() => fn(controller.signal));
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(Errors.pipelineTimeout());
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (timedOut) {
      operation.catch(() => {
        // The caller has already received PIPELINE_TIMEOUT. The underlying
        // provider may still reject later if it ignored AbortSignal.
      });
      throw Errors.pipelineTimeout();
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw Errors.pipelineTimeout();
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
