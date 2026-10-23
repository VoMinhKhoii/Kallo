/**
 * The app's colour themes. `light` is the cream product as it has always been;
 * `dark` is the Graphite design and `aurora` the brand-glow one. Both dark
 * themes set the `dark` Tailwind variant (see `@custom-variant dark` in
 * globals.css), so a `dark:` utility applies to either.
 *
 * The choice is stored per device in localStorage under THEME_STORAGE_KEY
 * (`theme-store.ts`) and painted onto <html> by `paint-theme.ts`. `system`
 * follows the OS and resolves to `light` or `dark`.
 */
export const APP_THEMES = ['light', 'dark', 'aurora'] as const;
export type AppTheme = (typeof APP_THEMES)[number];

/** The four choices Settings offers, in the order it lists them. */
export const THEME_CHOICES = ['system', 'light', 'dark', 'aurora'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_STORAGE_KEY = 'kallo-theme';

/**
 * The browser-chrome colour (`<meta name="theme-color">`) per theme: the page
 * canvas, so a standalone PWA's status-bar zone continues the page.
 */
export const THEME_COLOR: Record<AppTheme, string> = {
  light: '#fcfcfc',
  dark: '#0f0f0e',
  aurora: '#131114',
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    typeof value === 'string' &&
    (THEME_CHOICES as readonly string[]).includes(value)
  );
}
