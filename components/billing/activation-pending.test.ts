import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearActivationPending,
  hasActivationPending,
  markActivationPending,
  recordActivationRecoveryAttempt,
} from './activation-pending';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('activation pending marker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('survives a reload so recovery can run on a later visit', () => {
    markActivationPending('user-a');
    expect(hasActivationPending('user-a')).toBe(true);
  });

  it('is scoped per user', () => {
    markActivationPending('user-a');
    expect(hasActivationPending('user-b')).toBe(false);
  });

  it('clears once the grant lands', () => {
    markActivationPending('user-a');
    clearActivationPending('user-a');
    expect(hasActivationPending('user-a')).toBe(false);
  });

  it('expires rather than spending reconcile budget forever', () => {
    const markedAt = 1_000_000;
    markActivationPending('user-a', markedAt);
    expect(hasActivationPending('user-a', markedAt + DAY_MS - 1)).toBe(true);
    expect(hasActivationPending('user-a', markedAt + DAY_MS)).toBe(false);
    // The expiry check also evicts the entry so it cannot be re-read.
    expect(window.localStorage.length).toBe(0);
  });

  it('treats corrupt values as absent instead of throwing', () => {
    window.localStorage.setItem(
      'kallo.billing.activationPending.user-a',
      'not-a-number'
    );
    expect(hasActivationPending('user-a')).toBe(false);
  });

  it('survives a recovery attempt that did not find the purchase', () => {
    // The provider can still be ingesting the transaction. One miss must not
    // retire the only signal that the user paid.
    markActivationPending('user-a');
    recordActivationRecoveryAttempt('user-a');
    expect(hasActivationPending('user-a')).toBe(true);
  });

  it('retires after a bounded number of failed recoveries', () => {
    markActivationPending('user-a');
    recordActivationRecoveryAttempt('user-a');
    recordActivationRecoveryAttempt('user-a');
    // Third attempt exhausts the budget, so it cannot keep spending reconciles
    // against the 20/hr and 100/day per-user ceilings.
    recordActivationRecoveryAttempt('user-a');
    expect(hasActivationPending('user-a')).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });

  it('counting an attempt on a cleared marker does not resurrect it', () => {
    recordActivationRecoveryAttempt('user-a');
    expect(hasActivationPending('user-a')).toBe(false);
  });

  it('reads the legacy bare-timestamp format written by an older deploy', () => {
    // An activation in flight across a deploy must not be silently dropped.
    window.localStorage.setItem(
      'kallo.billing.activationPending.user-a',
      String(Date.now())
    );
    expect(hasActivationPending('user-a')).toBe(true);
  });
});
