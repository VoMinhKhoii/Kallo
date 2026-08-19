import { describe, expect, it } from 'vitest';
import {
  assertBillingIdentity,
  BillingIdentityMismatchError,
} from '@/lib/domain/billing/identity';

describe('assertBillingIdentity', () => {
  it('accepts the freshly authenticated expected account', () => {
    expect(() => assertBillingIdentity('user-a', 'user-a')).not.toThrow();
  });

  it.each([
    ['user-b'],
    [undefined],
    [null],
  ])('rejects a stale or missing authenticated identity (%s)', (actual) => {
    expect(() => assertBillingIdentity('user-a', actual)).toThrow(
      BillingIdentityMismatchError
    );
  });
});
