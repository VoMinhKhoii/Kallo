// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { earlyThemeToggle } from '../early-theme-toggle';

function arm() {
  const add = vi.spyOn(document, 'addEventListener');
  const paint = vi.fn();
  earlyThemeToggle('key', {}, paint);
  const onClick = add.mock.calls[0]?.[1] as (event: Event) => void;
  const button = document.createElement('button');
  button.dataset.themeToggle = '';
  document.body.append(button);
  const click = () => onClick({ target: button } as unknown as Event);
  return { button, click, paint };
}

describe('earlyThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset.unstoredTheme;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('flips light to dark and stores it', () => {
    const { click, paint } = arm();
    click();
    expect(window.localStorage.getItem('key')).toBe('dark');
    expect(paint).toHaveBeenCalledWith('key', {}, 'dark');
  });

  it('flips Aurora to light', () => {
    document.documentElement.classList.add('aurora');
    const { click, paint } = arm();
    click();
    expect(paint).toHaveBeenCalledWith('key', {}, 'light');
  });

  it('leaves the click to React once hydrated', () => {
    const { button, click, paint } = arm();
    button.dataset.hydrated = 'true';
    click();
    expect(paint).not.toHaveBeenCalled();
  });

  it('remembers the choice on the page when storage is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { click, paint } = arm();
    click();
    expect(document.documentElement.dataset.unstoredTheme).toBe('dark');
    expect(paint).toHaveBeenCalledWith('key', {}, 'dark');
  });
});
