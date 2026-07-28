import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBillingConfig } from '../config';

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.SUBSCRIPTION_LAUNCH_DATE;
  delete process.env.TRIAL_DAYS;
  delete process.env.BILLING_ENFORCEMENT_ENABLED;
  delete process.env.BILLING_PURCHASES_ENABLED;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getBillingConfig', () => {
  it('defaults: launchDate null, trialDays 7, enforcement off', () => {
    const config = getBillingConfig();
    expect(config.launchDate).toBeNull();
    expect(config.trialDays).toBe(7);
    expect(config.enforcementEnabled).toBe(false);
    expect(config.purchasesEnabled).toBe(false);
  });

  it('enables purchases independently from enforcement', () => {
    process.env.BILLING_PURCHASES_ENABLED = 'true';
    expect(getBillingConfig().purchasesEnabled).toBe(true);
    expect(getBillingConfig().enforcementEnabled).toBe(false);
  });

  it('parses a valid ISO launch date', () => {
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-01T00:00:00.000Z';
    expect(getBillingConfig().launchDate?.toISOString()).toBe(
      '2026-08-01T00:00:00.000Z'
    );
  });

  it('invalid launch date → null', () => {
    process.env.SUBSCRIPTION_LAUNCH_DATE = 'not-a-date';
    expect(getBillingConfig().launchDate).toBeNull();
  });

  it('non-positive / non-integer TRIAL_DAYS falls back to 7', () => {
    process.env.TRIAL_DAYS = '0';
    expect(getBillingConfig().trialDays).toBe(7);
    process.env.TRIAL_DAYS = 'abc';
    expect(getBillingConfig().trialDays).toBe(7);
  });

  it('enforcement toggles via readBooleanEnv', () => {
    process.env.BILLING_ENFORCEMENT_ENABLED = 'true';
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-01T00:00:00.000Z';
    expect(getBillingConfig().enforcementEnabled).toBe(true);
  });

  it('fails closed when enforcement has no valid launch date', () => {
    process.env.BILLING_ENFORCEMENT_ENABLED = 'true';
    expect(() => getBillingConfig()).toThrow(
      'billing_enforcement_requires_valid_launch_date'
    );

    process.env.SUBSCRIPTION_LAUNCH_DATE = 'not-a-date';
    expect(() => getBillingConfig()).toThrow(
      'billing_enforcement_requires_valid_launch_date'
    );
  });
});
