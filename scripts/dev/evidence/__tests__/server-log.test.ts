import { describe, expect, it } from 'vitest';
import { apiFailures, markLog, sinceMark } from '../server-log.mjs';

const before = Buffer.from(
  ' ▲ Next.js 16.3\n GET /api/v1/dashboard?date=1 401 in 4.0s (next.js: 2.6s)\n'
);

describe('sinceMark', () => {
  it('returns only what the server wrote after the mark', () => {
    const later = ' GET /api/v1/meals 200 in 90ms\n';
    const log = Buffer.concat([before, Buffer.from(later)]);
    expect(sinceMark(log, markLog(before))).toEqual({
      text: later,
      fromMark: true,
    });
  });

  it('reads the whole log when a restart truncated it and it regrew past the mark', () => {
    const restarted = Buffer.from(
      ' ▲ Next.js 16.3\n GET /api/v1/groups/profile 401 in 1.5s (next.js: 19ms)\n GET /api/v1/x 200 in 1ms\n'
    );
    expect(restarted.length).toBeGreaterThan(before.length);
    const { text, fromMark } = sinceMark(restarted, markLog(before));
    expect(fromMark).toBe(false);
    expect(apiFailures(text)).toEqual(['GET /api/v1/groups/profile → 401']);
  });

  it('reads the whole log when it is shorter than the mark or unmarked', () => {
    expect(sinceMark(Buffer.from('x'), markLog(before)).fromMark).toBe(false);
    expect(sinceMark(before, null)).toEqual({
      text: before.toString(),
      fromMark: false,
    });
  });
});

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
