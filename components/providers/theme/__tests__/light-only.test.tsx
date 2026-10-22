import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LightOnly } from '../light-only';

describe('LightOnly', () => {
  afterEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    document.head.innerHTML = '';
  });

  // Signing out lands on the landing page by client navigation, with the
  // app's theme class still on <html>.
  it.each(['dark', 'aurora'])('takes the %s theme off <html>', (theme) => {
    const html = document.documentElement;
    html.classList.add(theme, 'keep-me');
    html.style.colorScheme = 'dark';
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#0f0f0e';
    document.head.append(meta);

    render(<LightOnly />);

    expect(html.classList.contains(theme)).toBe(false);
    expect(html.classList.contains('keep-me')).toBe(true);
    expect(html.style.colorScheme).toBe('light');
    expect(meta.content).toBe('#fcfcfc');
  });
});
