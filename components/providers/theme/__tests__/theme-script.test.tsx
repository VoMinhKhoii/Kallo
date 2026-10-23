import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeScript } from '../theme-script';

const html = document.documentElement;

/** The script body the server sends, as the browser would see it. */
function serverScript(): string {
  const markup = renderToString(<ThemeScript />);
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host.querySelector('script')?.textContent ?? '';
}

describe('ThemeScript', () => {
  afterEach(() => {
    localStorage.clear();
    html.className = '';
  });

  it('ships a script in the server HTML that paints the stored theme', () => {
    localStorage.setItem('kallo-theme', 'aurora');

    new Function(serverScript())();

    expect(html.className).toBe('aurora');
  });

  it('never carries a raw "<" that could close the tag', () => {
    expect(serverScript()).not.toMatch(/<\/?script/i);
  });

  // React warns about a script it creates on a client navigation, and such a
  // script never runs; ThemeApplier covers that case.
  it('renders nothing when mounted on the client', () => {
    const { container } = render(<ThemeScript />);

    expect(container.querySelector('script')).toBeNull();
  });
});
