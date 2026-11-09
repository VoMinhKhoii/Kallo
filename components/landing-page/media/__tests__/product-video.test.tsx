import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductVideo } from '../product-video';

const clip = { src: '/a.mp4', mobileSrc: '/a-sm.mp4', poster: '/a.webp' };

function setup({ reduceMotion = false } = {}) {
  const observers: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduceMotion }))
  );
  const fire = (index: number) =>
    act(() => {
      observers[index]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
  return { approach: () => fire(0), enter: () => fire(1) };
}

describe('ProductVideo', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads nothing until the frame nears the viewport', () => {
    setup();
    const { container } = render(
      <ProductVideo clip={clip} width={16} height={9} label="demo" />
    );
    expect(container.querySelectorAll('source')).toHaveLength(0);
    expect(container.querySelector('video')?.hasAttribute('poster')).toBe(
      false
    );
  });

  it('shows the poster once the frame is near', () => {
    const { approach } = setup();
    const { container } = render(
      <ProductVideo clip={clip} width={16} height={9} label="demo" />
    );
    approach();
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(
      '/a.webp'
    );
  });

  it('leaves the poster to whatever sits behind the video', () => {
    const { approach } = setup();
    const { container } = render(
      <ProductVideo
        clip={clip}
        width={16}
        height={9}
        label="demo"
        poster={false}
      />
    );
    approach();
    expect(container.querySelector('video')?.hasAttribute('poster')).toBe(
      false
    );
  });

  it('keeps the poster and skips the film on a very slow connection', () => {
    const { approach, enter } = setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      connection: { effectiveType: '2g' },
    });
    const { container } = render(
      <ProductVideo clip={clip} width={16} height={9} label="demo" />
    );
    approach();
    enter();
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(
      '/a.webp'
    );
    expect(container.querySelectorAll('source')).toHaveLength(0);
  });

  it('loads ahead of the viewport but only plays once on screen', () => {
    const { approach, enter } = setup();
    const { container } = render(
      <ProductVideo clip={clip} width={16} height={9} label="demo" />
    );
    approach();
    expect(container.querySelectorAll('source')).toHaveLength(2);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    enter();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('keeps the poster for visitors who asked for less motion', () => {
    const { approach, enter } = setup({ reduceMotion: true });
    const { container } = render(
      <ProductVideo clip={clip} width={16} height={9} label="demo" />
    );
    approach();
    enter();
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(
      '/a.webp'
    );
    expect(container.querySelectorAll('source')).toHaveLength(0);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
});
