import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BuildAnalysisGuardEventInput,
  buildAnalysisGuardEvent,
} from '../analysis-guards';

const hashSecret = 'analysis-guard-unit-test-secret';

function hmacHex(payload: string) {
  return createHmac('sha256', hashSecret).update(payload).digest('hex');
}

describe('buildAnalysisGuardEvent', () => {
  beforeEach(() => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', hashSecret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds blocked-request telemetry without raw input or identifiers', () => {
    const input = {
      userId: '24542863-704b-4626-a28c-1a4f9c0e1335',
      ip: '203.0.113.24',
      route: '/api/analyze-meal',
      reason: 'per_user_minute',
      retryAfterSeconds: 45,
      rawMealText: 'pho bo tai chin',
    } satisfies BuildAnalysisGuardEventInput & { rawMealText: string };

    const row = buildAnalysisGuardEvent(input);

    expect(row).toEqual({
      userIdHash: hmacHex(`user:${input.userId}`),
      ipHash: hmacHex(`ip:${input.ip}`),
      route: input.route,
      reason: input.reason,
      retryAfterSeconds: input.retryAfterSeconds,
    });
    expect(row.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.userIdHash).not.toBe(row.ipHash);
    expect(row).not.toHaveProperty('rawMealText');
    expect(row).not.toHaveProperty('rawInput');
    expect(row).not.toHaveProperty('userId');
    expect(row).not.toHaveProperty('ip');
    expect(JSON.stringify(row)).not.toContain(input.rawMealText);
    expect(JSON.stringify(row)).not.toContain(input.userId);
    expect(JSON.stringify(row)).not.toContain(input.ip);
  });

  it('uses domain-separated hashes for the same identifier value', () => {
    const sharedIdentifier = 'shared-identifier';

    const row = buildAnalysisGuardEvent({
      userId: sharedIdentifier,
      ip: sharedIdentifier,
      route: '/api/analyze-meal',
      reason: 'spam_preflight',
      retryAfterSeconds: null,
    });

    expect(row.userIdHash).toBe(hmacHex(`user:${sharedIdentifier}`));
    expect(row.ipHash).toBe(hmacHex(`ip:${sharedIdentifier}`));
    expect(row.userIdHash).not.toBe(row.ipHash);
  });

  it('keeps missing identifiers nullable', () => {
    const row = buildAnalysisGuardEvent({
      userId: null,
      ip: undefined,
      route: '/api/analyze-meal',
      reason: 'global_budget',
    });

    expect(row).toEqual({
      userIdHash: null,
      ipHash: null,
      route: '/api/analyze-meal',
      reason: 'global_budget',
      retryAfterSeconds: null,
    });
  });

  it('allows deterministic fallback hashing only during tests', () => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'test');

    const first = buildAnalysisGuardEvent({
      userId: 'test-user',
      ip: '198.51.100.10',
      route: '/api/analyze-meal',
      reason: 'provider_pressure',
    });
    const second = buildAnalysisGuardEvent({
      userId: 'test-user',
      ip: '198.51.100.10',
      route: '/api/analyze-meal',
      reason: 'provider_pressure',
    });

    expect(first).toEqual(second);
    expect(first.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed outside tests when ANALYSIS_GUARD_HASH_SECRET is absent', () => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() =>
      buildAnalysisGuardEvent({
        userId: 'user-id',
        ip: '203.0.113.10',
        route: '/api/analyze-meal',
        reason: 'per_user_hour',
      })
    ).toThrow(/ANALYSIS_GUARD_HASH_SECRET/);
  });
});
