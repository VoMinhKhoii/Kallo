import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  let matches: boolean;
  let listeners: EventListener[];
  const original = window.matchMedia;

  beforeEach(() => {
    matches = false;
    listeners = [];
    window.matchMedia = vi.fn(
      (query: string): MediaQueryList => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: (_: string, fn: EventListener) => {
          listeners.push(fn);
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => false,
      })
    );
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('asks for the md breakpoint', () => {
    renderHook(() => useIsMobile());
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('is right on the first render — no desktop frame on a phone', () => {
    matches = true;
    const seen: boolean[] = [];
    renderHook(() => {
      const isMobile = useIsMobile();
      seen.push(isMobile);
      return isMobile;
    });
    expect(seen[0]).toBe(true);
  });

  it('follows the breakpoint as the viewport changes', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    matches = true;
    act(() => {
      for (const listener of listeners) listener(new Event('change'));
    });
    expect(result.current).toBe(true);
  });

  it('answers false where matchMedia does not exist', () => {
    // @ts-expect-error — simulating a host without matchMedia
    window.matchMedia = undefined;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
