import { logThrottled } from '../log-throttle';
import type { RateLimitKeyKind } from '../types';
import type { LeaseStore } from './lease-sql';

/**
 * What `acquireRateLimit` / `acquireSpendLease` hand back: a held slot and/or
 * a spend reservation, given back by `release`.
 *
 * Spend is counted in micro-USD, so a $0.0048 meal is 4800, not a rounding
 * error.
 */
export interface RateLimitLease {
  /**
   * Free the slot and swap the spend estimate for the real cost, in one
   * call. `null` or no cost (a cost we could not price) keeps the estimate
   * counted. Runs once; never throws — a failed release leaves the estimate
   * in place and the slot to its lifetime, both the safe side.
   */
  release(actualCostUsd?: number | null): Promise<void>;
  /** A cost that arrived after `release` (a call that outlived its request). */
  addLate(costUsd: number): void;
}

export function toMicroUsd(usd: number): number {
  return Math.round(usd * 1_000_000);
}

/**
 * The lease `acquireLease` hands back once a call is admitted: `release` frees
 * the slot (when one is held) and settles the spend in one call.
 */
export function createLease(args: {
  store: LeaseStore;
  route: string;
  keyKind: RateLimitKeyKind;
  /** The slot held on this key, with the expiry the consume granted it. */
  slot: { keyHash: string; expiresAt: string } | null;
  spendDay: string;
  reservedMicroUsd: number;
  /** What an unknown cost is booked at: the kind's estimate. */
  estimateMicroUsd: number;
  tracksSpend: boolean;
  timeoutMs: number;
}): RateLimitLease {
  let released: Promise<void> | undefined;

  const send = (freeSlot: boolean, deltaMicroUsd: number) => {
    const slot = freeSlot ? args.slot : null;
    return slot == null && deltaMicroUsd === 0
      ? Promise.resolve()
      : args.store
          .release({
            keyKind: args.keyKind,
            keyHash: slot?.keyHash ?? null,
            slotExpiresAt: slot?.expiresAt ?? null,
            route: args.route,
            spendDay: deltaMicroUsd === 0 ? null : args.spendDay,
            deltaMicroUsd: deltaMicroUsd === 0 ? null : deltaMicroUsd,
            timeoutMs: args.timeoutMs,
          })
          .catch((error) => {
            logThrottled(
              `release:${args.route}`,
              `[rate-limit] release failed for ${args.route}`,
              error
            );
          });
  };

  return {
    release(actualCostUsd) {
      // An unknown cost books the estimate: already reserved on an enforced
      // lease (delta 0), booked here on an App Review one, which reserved
      // nothing.
      released ??= send(
        true,
        args.tracksSpend
          ? (actualCostUsd == null
              ? args.estimateMicroUsd
              : toMicroUsd(actualCostUsd)) - args.reservedMicroUsd
          : 0
      );
      return released;
    },
    addLate(costUsd) {
      if (args.tracksSpend) void send(false, toMicroUsd(costUsd));
    },
  };
}
