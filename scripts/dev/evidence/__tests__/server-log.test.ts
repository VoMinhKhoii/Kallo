import { describe, expect, it } from 'vitest';
import { apiFailures } from '../server-log.mjs';

describe('apiFailures', () => {
  it('counts each failing API endpoint once, without its query', () => {
    const log = [
      ' GET /api/v1/dashboard?date=2026-10-20&tz=-420 401 in 4.0s (next.js: 2.6s)',
      ' GET /api/v1/dashboard?date=2026-10-21&tz=-420 401 in 1.0s (next.js: 2.6s)',
      ' GET /api/v1/account/entitlements 200 in 358ms (next.js: 5ms)',
      ' POST /api/v1/meals 500 in 120ms (next.js: 5ms)',
      '○ Compiling /api/v1/onboarding/profile ...',
    ].join('\n');
    expect(apiFailures(log)).toEqual([
      'GET /api/v1/dashboard → 401 (2×)',
      'POST /api/v1/meals → 500',
    ]);
  });

  it('ignores page requests and successes', () => {
    const log = [
      ' GET /en/does-not-exist 404 in 80ms',
      ' GET /api/v1/groups/invites 200 in 4.7s',
    ].join('\n');
    expect(apiFailures(log)).toEqual([]);
  });
});
