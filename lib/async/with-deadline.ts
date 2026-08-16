import { Errors } from '@/lib/errors/catalog';

/**
 * Race a promise against a deadline.
 *
 * On timeout, rejects with `onTimeout()` (default: PIPELINE_TIMEOUT) and stops
 * waiting on the underlying promise.
 *
 * **The `lib/async` pair.** This folder holds the two ways to bound a slow
 * operation, and they split on one question: can the work be cancelled?
 * `@/lib/async/fetch-with-timeout` aborts the operation through an
 * `AbortSignal`; `withDeadline` does NOT — it only stops awaiting. Reach for
 * the sibling whenever the callee honours `AbortSignal` (`fetch`, LLM
 * providers); reach for this one when it does not.
 *
 * Use it for work that has no cancellation — notably `postgres.js` queries,
 * which ignore `AbortSignal` and keep running after a timeout. The point is to
 * stop *awaiting* so a stalled query can't wedge an SSE stream open (the query
 * may still settle later; its result is discarded).
 *
 * @param promise   — The operation to bound.
 * @param timeoutMs — Maximum time to wait before rejecting.
 * @param onTimeout — Builds the rejection error; defaults to PIPELINE_TIMEOUT.
 */
export async function withDeadline<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  onTimeout: () => Error = () => Errors.pipelineTimeout()
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    // Detach from a late rejection so a query that settles after the deadline
    // doesn't surface as an unhandled rejection.
    Promise.resolve(promise).catch(() => {});
  }
}
