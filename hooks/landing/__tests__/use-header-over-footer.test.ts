import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useHeaderOverFooter } from '../use-header-over-footer';

function rectAt(top: number, bottom: number): DOMRect {
  return { top, bottom } as DOMRect;
}

function mount(footerTop: { value: number } | null) {
  const header = document.createElement('header');
  header.getBoundingClientRect = () => rectAt(0, 80);
  document.body.append(header);
  if (footerTop) {
    const footer = document.createElement('footer');
    footer.getBoundingClientRect = () =>
      rectAt(footerTop.value, footerTop.value + 400);
    document.body.append(footer);
  }
  return renderHook(() => useHeaderOverFooter({ current: header }));
}

describe('useHeaderOverFooter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is false while the footer is below the header', () => {
    const { result } = mount({ value: 900 });
    expect(result.current).toBe(false);
  });

  it('turns on once the footer scrolls under the header, and off again', () => {
    const footerTop = { value: 900 };
    const { result } = mount(footerTop);

    footerTop.value = 40;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);

    footerTop.value = 300;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(false);
  });

  it('starts on when the page loads already scrolled to the footer', () => {
    const { result } = mount({ value: 10 });
    expect(result.current).toBe(true);
  });

  it('stays off on a page without a footer', () => {
    const { result } = mount(null);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(false);
  });
});
