// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollReveal } from '../use-scroll-reveal';

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let fire: Callback;
let options: IntersectionObserverInit | undefined;
const observed = new Set<Element>();

class FakeObserver {
  constructor(callback: Callback, init?: IntersectionObserverInit) {
    fire = callback;
    options = init;
  }
  observe(el: Element) {
    observed.add(el);
  }
  unobserve(el: Element) {
    observed.delete(el);
  }
  disconnect() {
    observed.clear();
  }
}

/** A `data-reveal` block whose top edge sits `top` px from the viewport top. */
function block(root: HTMLElement, top: number): HTMLElement {
  const el = document.createElement('div');
  el.dataset.reveal = '';
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  root.append(el);
  return el;
}

describe('useScrollReveal', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('innerHeight', 800);
    observed.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides only the blocks entirely below the viewport, then shows each once it is 80px in', () => {
    const root = document.createElement('section');
    const onScreen = block(root, 300);
    const atTheEdge = block(root, 780);
    const below = block(root, 1400);

    renderHook(() => useScrollReveal({ current: root }));

    expect(options?.rootMargin).toBe('-80px');
    expect(onScreen.dataset.reveal).toBe('');
    expect(atTheEdge.dataset.reveal).toBe('');
    expect(below.dataset.reveal).toBe('pending');
    expect([...observed]).toEqual([below]);

    act(() => fire([{ target: below, isIntersecting: false }]));
    expect(below.dataset.reveal).toBe('pending');

    act(() => fire([{ target: below, isIntersecting: true }]));
    expect(below.dataset.reveal).toBe('shown');
    expect(observed.size).toBe(0);
  });

  it('shows a block left pending when the page is hidden and shown again with it on screen', () => {
    // Cache Components keeps a route's DOM under <Activity> while it is hidden:
    // the effect is cleaned up (observer gone) and runs again on return.
    const root = document.createElement('section');
    const el = block(root, 1400);
    const first = renderHook(() => useScrollReveal({ current: root }));
    expect(el.dataset.reveal).toBe('pending');

    first.unmount();
    el.getBoundingClientRect = () => ({ top: 200 }) as DOMRect;
    renderHook(() => useScrollReveal({ current: root }));

    expect(el.dataset.reveal).toBe('shown');
    expect(observed.size).toBe(0);
  });

  it('leaves every block visible without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const root = document.createElement('section');
    const below = block(root, 1400);

    renderHook(() => useScrollReveal({ current: root }));

    expect(below.dataset.reveal).toBe('');
  });
});
