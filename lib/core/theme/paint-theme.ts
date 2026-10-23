/**
 * Paints a theme onto the document: the `dark` / `aurora` class on <html>,
 * its `color-scheme`, and `<meta name="theme-color">`. With no `forced` theme
 * it reads the stored Settings → Appearance choice (anything else, or nothing,
 * means System: the OS preference).
 *
 * Self-contained on purpose — no imports, no outer references: `ThemeScript`
 * serialises it with `Function.prototype.toString()` into the inline script
 * that runs before first paint, so that script and the running app paint a
 * theme the same way. The theme names here must match `APP_THEMES` (a test
 * holds them together).
 */
export function paintTheme(
  storageKey: string,
  colors: Record<string, string>,
  forced?: string
): void {
  let theme = forced;
  if (!theme) {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      stored = null;
    }
    theme =
      stored === 'light' || stored === 'dark' || stored === 'aurora'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  }
  const html = document.documentElement;
  html.classList.remove('dark', 'aurora');
  if (theme !== 'light') html.classList.add(theme);
  html.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && colors[theme]) meta.setAttribute('content', colors[theme]);
}
