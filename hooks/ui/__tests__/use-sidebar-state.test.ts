// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIDEBAR_EXPAND_MODE_COOKIE,
  SIDEBAR_STATE_COOKIE,
} from '@/lib/sidebar/cookies';
import { useSidebarState } from '../use-sidebar-state';

function clearCookies() {
  for (const name of [SIDEBAR_STATE_COOKIE, SIDEBAR_EXPAND_MODE_COOKIE]) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`;
}

function readCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

beforeEach(() => {
  clearCookies();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: fine'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.useRealTimers();
  clearCookies();
});

describe('useSidebarState — FSM transitions', () => {
  it('switching to hover from open returns to closed (resting state for hover)', () => {
    setCookie(SIDEBAR_STATE_COOKIE, 'open');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'click');

    const { result } = renderHook(() => useSidebarState());
    expect(result.current.state).toBe('open');

    act(() => {
      result.current.setExpandMode('hover');
    });

    expect(result.current.state).toBe('closed');
    expect(result.current.expandMode).toBe('hover');
    expect(readCookie(SIDEBAR_STATE_COOKIE)).toBe('closed');
  });

  it('switching to click while peeked locks the visual: peeked → open', async () => {
    setCookie(SIDEBAR_STATE_COOKIE, 'closed');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'hover');

    vi.useFakeTimers();
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.onPointerEnter();
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.state).toBe('peeked');

    act(() => {
      result.current.setExpandMode('click');
    });

    expect(result.current.state).toBe('open');
    expect(result.current.expandMode).toBe('click');
    expect(readCookie(SIDEBAR_STATE_COOKIE)).toBe('open');

    // Hover-out must NOT collapse — pointer events are dead in click mode.
    act(() => {
      result.current.onPointerLeave();
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.state).toBe('open');
  });

  it('hover-leave is a no-op in click mode (focus-peek must survive)', () => {
    setCookie(SIDEBAR_STATE_COOKIE, 'closed');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'click');

    vi.useFakeTimers();
    const { result } = renderHook(() => useSidebarState());

    // Keyboard tab into rail → focus-peek expands.
    act(() => {
      result.current.onFocusEnter();
    });
    expect(result.current.state).toBe('peeked');

    // Mouse drifts in then out — must not touch the FSM in click mode.
    act(() => {
      result.current.onPointerEnter();
      result.current.onPointerLeave();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state).toBe('peeked');
  });

  it('toggling hover→click cancels a pending peek-in timer', () => {
    setCookie(SIDEBAR_STATE_COOKIE, 'closed');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'hover');

    vi.useFakeTimers();
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.onPointerEnter();
    });
    // Mode flips before peek-in fires.
    act(() => {
      result.current.setExpandMode('click');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state).toBe('closed');
    expect(result.current.expandMode).toBe('click');
  });

  it('REGRESSION: in hover mode, peek-in then hover-out collapses', async () => {
    // Repro of the user-reported bug: hover-in (peek) → click whitespace
    // (was: incorrectly pinned open) → hover-out → "did not collapse."
    // Fix lives in desktop-sidebar.tsx: handleAsideClick is a no-op in
    // hover mode. The hook-level invariant we test here is symmetric:
    // from 'peeked', a hover-out alone returns to 'closed'.
    setCookie(SIDEBAR_STATE_COOKIE, 'closed');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'hover');

    vi.useFakeTimers();
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.onPointerEnter();
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.state).toBe('peeked');

    act(() => {
      result.current.onPointerLeave();
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state).toBe('closed');
  });

  it('togglePinned in hover mode opens the rail; toggle again closes it', () => {
    setCookie(SIDEBAR_STATE_COOKIE, 'closed');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'hover');

    const { result } = renderHook(() => useSidebarState());
    expect(result.current.state).toBe('closed');

    act(() => {
      result.current.togglePinned();
    });
    expect(result.current.state).toBe('open');
    expect(result.current.expandMode).toBe('hover'); // mode preserved

    // From 'open', hover-out is a no-op.
    act(() => {
      result.current.onPointerLeave();
    });
    expect(result.current.state).toBe('open');

    // Toggle again → closed.
    act(() => {
      result.current.togglePinned();
    });
    expect(result.current.state).toBe('closed');
  });

  it('honors initialState/initialExpandMode from SSR when no cookie present', () => {
    clearCookies();
    const { result } = renderHook(() =>
      useSidebarState({ initialState: 'open', initialExpandMode: 'hover' })
    );
    expect(result.current.state).toBe('open');
    expect(result.current.expandMode).toBe('hover');
  });

  it('cookie value beats SSR initial value (live writes survive remount)', () => {
    // Simulates: a previous client interaction wrote 'closed' to cookie,
    // and the SSR layer happens to ship 'open' as the default. Cookie wins.
    setCookie(SIDEBAR_STATE_COOKIE, 'closed');
    setCookie(SIDEBAR_EXPAND_MODE_COOKIE, 'click');

    const { result } = renderHook(() =>
      useSidebarState({ initialState: 'open', initialExpandMode: 'hover' })
    );
    expect(result.current.state).toBe('closed');
    expect(result.current.expandMode).toBe('click');
  });

  it('falls back to SSR initial state when a cookie is malformed', () => {
    setCookie(SIDEBAR_STATE_COOKIE, '%');

    expect(() =>
      renderHook(() =>
        useSidebarState({ initialState: 'open', initialExpandMode: 'click' })
      )
    ).not.toThrow();

    const { result } = renderHook(() =>
      useSidebarState({ initialState: 'open', initialExpandMode: 'click' })
    );
    expect(result.current.state).toBe('open');
  });
});
