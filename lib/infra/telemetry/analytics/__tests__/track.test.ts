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

/** Lets timers, the dynamic import and every `.then` queued on them settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => state,
  });
}

describe('track (PostHog loaded after the page has loaded)', () => {
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    factory.mockClear();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setReadyState('complete');
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

  it("waits for the page's load event before importing PostHog", async () => {
    setReadyState('loading');
    const { trackPageview } = await import('../track');

    trackPageview();
    await settle();
    expect(factory).not.toHaveBeenCalled();
    expect(calls).toEqual([]);

    setReadyState('complete');
    window.dispatchEvent(new Event('load'));
    await settle();

    expect(calls).toEqual(['init', 'register', 'capture:$pageview']);
  });

  it('stays off after a failed load, so nothing is captured without its identify', async () => {
    const failingImport = vi.fn(() => {
      throw new Error('ChunkLoadError');
    });
    vi.doMock('posthog-js', failingImport);
    const { identifyUser, trackPageview } = await import('../track');

    identifyUser('user-1');
    await settle();
    trackPageview();
    await settle();
    vi.doUnmock('posthog-js');

    expect(failingImport).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
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
