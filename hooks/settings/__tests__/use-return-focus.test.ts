import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useReturnFocus } from '../use-return-focus';

function focusEvent(target: HTMLElement) {
  const event = new Event('focus', { cancelable: true });
  Object.defineProperty(event, 'currentTarget', { value: target });
  return event;
}

describe('useReturnFocus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the dialog on open and hands focus back to the opener', () => {
    const opener = document.createElement('button');
    const dialog = document.createElement('div');
    dialog.tabIndex = -1;
    document.body.append(opener, dialog);
    opener.focus();
    const { result } = renderHook(() => useReturnFocus());

    const open = focusEvent(dialog);
    result.current.onOpenAutoFocus(open);
    expect(open.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);

    const close = focusEvent(dialog);
    result.current.onCloseAutoFocus(close);
    expect(close.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('hands focus to the control that opened the menu it came from', () => {
    const trigger = document.createElement('button');
    trigger.setAttribute('aria-controls', 'account-menu');
    const menu = document.createElement('div');
    menu.id = 'account-menu';
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    menu.append(item);
    const dialog = document.createElement('div');
    dialog.tabIndex = -1;
    document.body.append(trigger, menu, dialog);
    item.focus();
    const { result } = renderHook(() => useReturnFocus());

    result.current.onOpenAutoFocus(focusEvent(dialog));
    menu.remove();
    result.current.onCloseAutoFocus(focusEvent(dialog));
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus alone when the opener has left the page', () => {
    const opener = document.createElement('button');
    const dialog = document.createElement('div');
    dialog.tabIndex = -1;
    document.body.append(opener, dialog);
    opener.focus();
    const { result } = renderHook(() => useReturnFocus());

    result.current.onOpenAutoFocus(focusEvent(dialog));
    opener.remove();
    expect(() =>
      result.current.onCloseAutoFocus(focusEvent(dialog))
    ).not.toThrow();
    expect(document.activeElement).not.toBe(opener);
  });
});
