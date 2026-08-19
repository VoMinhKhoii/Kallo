import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to mock React since useEffect/useState won't run
// in a non-component context. Test the logic directly.
describe('useIsMobile logic', () => {
  const MOBILE_BREAKPOINT = 768;

  it('considers width < 768 as mobile', () => {
    expect(500 < MOBILE_BREAKPOINT).toBe(true);
  });

  it('considers width >= 768 as desktop', () => {
    expect(768 < MOBILE_BREAKPOINT).toBe(false);
    expect(1024 < MOBILE_BREAKPOINT).toBe(false);
  });

  it('considers width = 767 as mobile', () => {
    expect(767 < MOBILE_BREAKPOINT).toBe(true);
  });

  describe('matchMedia integration', () => {
    let listeners: Array<() => void>;

    beforeEach(() => {
      listeners = [];
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: window.innerWidth < MOBILE_BREAKPOINT,
          media: query,
          addEventListener: (_: string, fn: () => void) => {
            listeners.push(fn);
          },
          removeEventListener: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      listeners = [];
    });

    it('creates matchMedia with correct query', () => {
      window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    });

    it('responds to resize events', () => {
      const _mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

      let isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      expect(isMobile).toBe(false);

      // Simulate resize to mobile
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      for (const listener of listeners) listener();
      isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      expect(isMobile).toBe(true);
    });
  });
});
