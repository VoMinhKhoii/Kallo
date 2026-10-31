import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsDialog, useSettingsLink } from '../use-settings-dialog';

// The real hook reads Next's search params; here they mirror the location,
// which is what Next syncs them to after a native pushState/replaceState.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function search() {
  return new URLSearchParams(window.location.search);
}

describe('useSettingsDialog', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/en/dashboard?tab=week');
  });

  it('opens by pushing ?settings= and keeps the rest of the URL', () => {
    const { result, rerender } = renderHook(() => useSettingsDialog());
    expect(result.current.isOpen).toBe(false);
    const before = window.history.length;

    act(() => result.current.open());
    rerender();

    expect(window.history.length).toBe(before + 1);
    expect(window.location.pathname).toBe('/en/dashboard');
    expect(search().get('tab')).toBe('week');
    expect(result.current.isOpen).toBe(true);
    expect(result.current.page).toBeNull();
  });

  it('switches pages in place without stacking history', () => {
    const { result, rerender } = renderHook(() => useSettingsDialog());
    act(() => result.current.open('profile'));
    const before = window.history.length;

    act(() => result.current.show('cooking'));
    rerender();

    expect(window.history.length).toBe(before);
    expect(result.current.page).toBe('cooking');
  });

  it('steps back on close when it pushed the entry itself', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { result } = renderHook(() => useSettingsDialog());
    act(() => result.current.open('plan'));

    act(() => result.current.close());

    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('drops the param on close when the dialog was opened by URL', () => {
    window.history.replaceState(null, '', '/en/dashboard?settings=account');
    const back = vi.spyOn(window.history, 'back');
    const { result, rerender } = renderHook(() => useSettingsDialog());
    expect(result.current.page).toBe('account');

    act(() => result.current.close());
    rerender();

    expect(back).not.toHaveBeenCalled();
    expect(search().has('settings')).toBe(false);
    expect(result.current.isOpen).toBe(false);
    back.mockRestore();
  });

  it('drops the param instead of stepping back once the entry was replaced', () => {
    const back = vi.spyOn(window.history, 'back');
    const { result, rerender } = renderHook(() => useSettingsDialog());
    act(() => result.current.open('preferences'));
    // A language switch inside the dialog: the router replaces the entry
    // with its own state, at the new locale's URL.
    act(() =>
      window.history.replaceState(
        { __NA: true },
        '',
        '/vi/dashboard?settings=preferences'
      )
    );

    act(() => result.current.close());
    rerender();

    expect(back).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/vi/dashboard');
    expect(search().has('settings')).toBe(false);
    back.mockRestore();
  });

  it('keeps the pushed mark across page switches', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { result } = renderHook(() => useSettingsDialog());
    act(() => result.current.open());
    act(() => result.current.show('account'));

    act(() => result.current.close());

    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('treats an unknown page as open on no particular page', () => {
    window.history.replaceState(null, '', '/en/dashboard?settings=billing');
    const { result } = renderHook(() => useSettingsDialog());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.page).toBeNull();
  });
});

describe('useSettingsLink', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/en/dashboard');
  });

  function click(overrides: Partial<MouseEvent> = {}) {
    const preventDefault = vi.fn();
    return {
      event: {
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault,
        ...overrides,
      } as unknown as React.MouseEvent<HTMLAnchorElement>,
      preventDefault,
    };
  }

  it('opens the dialog in place on a plain click', () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useSettingsLink(onOpen));
    const { event, preventDefault } = click();

    act(() => result.current.onClick(event));

    expect(preventDefault).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalled();
    expect(search().get('settings')).toBe('');
  });

  it('lets a cmd-click follow /settings into a new tab', () => {
    const { result } = renderHook(() => useSettingsLink());
    const { event, preventDefault } = click({ metaKey: true });

    act(() => result.current.onClick(event));

    expect(result.current.href).toBe('/settings');
    expect(preventDefault).not.toHaveBeenCalled();
    expect(search().has('settings')).toBe(false);
  });
});
