import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBillingConfig } from '../config';

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.BILLING_ENFORCEMENT_ENABLED;
  delete process.env.BILLING_PURCHASES_ENABLED;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getBillingConfig', () => {
  it('defaults: enforcement and purchases both off', () => {
    expect(getBillingConfig()).toEqual({
      enforcementEnabled: false,
      purchasesEnabled: false,
    });
  });

  it('enables purchases independently from enforcement', () => {
    process.env.BILLING_PURCHASES_ENABLED = 'true';
    expect(getBillingConfig().purchasesEnabled).toBe(true);
    expect(getBillingConfig().enforcementEnabled).toBe(false);
  });

  it('enforcement toggles via readBooleanEnv', () => {
    process.env.BILLING_ENFORCEMENT_ENABLED = 'true';
    expect(getBillingConfig().enforcementEnabled).toBe(true);
  });
});
