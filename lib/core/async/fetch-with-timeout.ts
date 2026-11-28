import { Errors } from '@/lib/core/errors/catalog';

/**
 * Wrap an async operation with a timeout, aborting it when the timeout fires.
 *
 * **The `lib/async` pair.** This folder holds the two ways to bound a slow
 * operation, and they split on one question: can the work be cancelled? This
 * one aborts the operation through an `AbortSignal`;
 * `@/lib/core/async/with-deadline` does NOT — it only stops awaiting.
 *
 * **Important**: This is intended for `fetch` calls and other abort-aware
 * operations. Do NOT use for database queries — `postgres.js` has no
 * `AbortSignal` support, so the underlying query continues running even after
 * the timeout fires. Use `withDeadline` for those.
 *
 * @param fn      — Async function to execute. Receives an `AbortSignal`
 *                  that callers can forward to `fetch()`.
 * @param timeoutMs — Maximum time in ms before the operation is aborted.
 * @param label   — Human-readable label for logging / debugging.
 */
export async function fetchWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  _label: string,
  parentSignal?: AbortSignal
): Promise<T> {
  if (parentSignal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const controller = new AbortController();
  let timedOut = false;
  let parentAborted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;

  const operation = Promise.resolve().then(() => fn(controller.signal));
  const raceStop = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(Errors.pipelineTimeout());
    }, timeoutMs);
    if (parentSignal) {
      onParentAbort = () => {
        parentAborted = true;
        controller.abort();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      };
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  });

  try {
    return await Promise.race([operation, raceStop]);
  } catch (error) {
    if (timedOut || parentAborted) {
      operation.catch(() => {
        // The caller has already settled. The underlying provider may still
        // reject later if it ignored AbortSignal.
      });
    }
    if (parentAborted) {
      throw error;
    }
    if (timedOut) {
      throw Errors.pipelineTimeout();
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw Errors.pipelineTimeout();
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (parentSignal && onParentAbort) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}
