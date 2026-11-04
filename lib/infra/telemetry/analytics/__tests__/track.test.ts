// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const posthog = {
  init: vi.fn(() => calls.push('init')),
  register: vi.fn(() => calls.push('register')),
  capture: vi.fn((event: string) => calls.push(`capture:${event}`)),
  identify: vi.fn((id: string) => calls.push(`identify:${id}`)),
  get_distinct_id: vi.fn(() => 'anon'),
  _isIdentified: vi.fn(() => false),
  reset: vi.fn(() => calls.push('reset')),
};
const factory = vi.fn(() => ({ default: posthog }));
vi.mock('posthog-js', () => factory());

/** Lets the dynamic import and every `.then` queued on it settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('track (PostHog loaded on first use)', () => {
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    factory.mockClear();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('initialises once, then runs the calls made while loading in order', async () => {
    const { identifyUser, trackPageview, track } = await import('../track');

    identifyUser('user-1');
    trackPageview();
    track('meal_logged', { method: 'ai' });
    expect(calls).toEqual([]);

    await settle();

    expect(calls).toEqual([
      'init',
      'register',
      'identify:user-1',
      'capture:$pageview',
      'capture:meal_logged',
    ]);
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it('never imports PostHog when analytics is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    const { trackPageview } = await import('../track');

    trackPageview();
    await settle();

    expect(factory).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
