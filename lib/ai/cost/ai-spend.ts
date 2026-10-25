import { isBillingSandboxUser } from '@/lib/domain/billing/revenuecat/identity';
import {
  type AcquireSpendLeaseOptions,
  type AiSpendKind,
  acquireSpendLease,
  aiSpendEstimatesUsd,
  type SpendLease,
} from '@/lib/infra/rate-limit/limiter/limiter';
import { runMetered } from './spend-meter';

/**
 * One unit of paid AI work under the app-wide spend brake.
 *
 *  - `reserve` books the kind's estimate, and throws the brake's 429 (or 503
 *    when the brake cannot be read) — before any model is called.
 *  - `run` executes work with every model attempt inside it metered.
 *  - `settle` swaps the estimate for the metered cost. An attempt that could
 *    not be priced keeps the whole estimate counted; an attempt that finishes
 *    after `settle` (a call that outlived its request) is added on its own,
 *    at the kind's estimate when it could not be priced.
 *
 * Split into three because the callers are: analyze-meal reserves before its
 * stream opens and runs the work inside it, and OCR reserves only once the
 * upload has been decoded, right before the provider call.
 */
export interface AiSpend {
  reserve(): Promise<void>;
  run<T>(work: () => Promise<T>): Promise<T>;
  /** Never throws. */
  settle(): Promise<void>;
}

export interface AiSpendOptions {
  /**
   * Whose request this is. App Review accounts (`BILLING_SANDBOX_USER_IDS`)
   * are never refused by the brake — a build in review must not fail on an
   * app-wide limit — but what they spend still counts.
   */
  userId?: string | null;
  /**
   * A per-user policy (windows and one-at-a-time slot) taken in the same
   * database call as the reservation; `settle` frees its slot.
   */
  rateLimit?: AcquireSpendLeaseOptions['rateLimit'];
}

export function createAiSpend(
  kind: AiSpendKind,
  options: AiSpendOptions = {}
): AiSpend {
  let lease: SpendLease | undefined;
  let knownUsd = 0;
  let unpriced = false;
  let settled = false;

  const meter = {
    record(costUsd: number | null) {
      if (settled) {
        // The settle may already have refunded the estimate, so an unpriced
        // late attempt books the estimate again rather than nothing.
        const lateUsd = costUsd ?? aiSpendEstimatesUsd[kind];
        if (lateUsd > 0) lease?.addLate(lateUsd);
        return;
      }
      if (costUsd == null) unpriced = true;
      else knownUsd += costUsd;
    },
  };

  return {
    async reserve() {
      if (lease) return;
      lease = await acquireSpendLease(kind, {
        enforce: !(options.userId && isBillingSandboxUser(options.userId)),
        rateLimit: options.rateLimit,
      });
    },
    run: (work) => runMetered(meter, work),
    async settle() {
      if (settled) return;
      settled = true;
      // An unpriced attempt cost something unknown on top of what was
      // priced: book at least the estimate, and never less than the priced
      // part.
      await lease?.release(
        unpriced ? Math.max(knownUsd, aiSpendEstimatesUsd[kind]) : knownUsd
      );
    },
  };
}

/** Reserve, run `work` metered, settle — for work that is one call. */
export async function withAiSpend<T>(
  kind: AiSpendKind,
  options: AiSpendOptions,
  work: () => Promise<T>
): Promise<T> {
  const spend = createAiSpend(kind, options);
  await spend.reserve();
  try {
    return await spend.run(work);
  } finally {
    await spend.settle();
  }
}
