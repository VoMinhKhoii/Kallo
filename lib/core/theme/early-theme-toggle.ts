/**
 * Lets the landing header's theme switch (`data-theme-toggle`) work before the
 * page's scripts arrive, which on a slow connection is many seconds after it is
 * on screen. The switch marks itself `data-hydrated` once React owns the click.
 *
 * Self-contained, like `paintTheme`: `ThemeScript` serialises it into the inline
 * script, so it takes everything it needs as arguments.
 */
export function earlyThemeToggle(
  storageKey: string,
  colors: Record<string, string>,
  paint: (
    storageKey: string,
    colors: Record<string, string>,
    forced: string
  ) => void
): void {
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const button = (
      target?.closest ? target.closest('[data-theme-toggle]') : null
    ) as HTMLElement | null;
    if (!button || button.dataset.hydrated) return;

    const html = document.documentElement;
    const isDark =
      html.classList.contains('dark') || html.classList.contains('aurora');
    const next = isDark ? 'light' : 'dark';
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Read back by `readThemeChoice`, so hydration keeps this choice.
      html.dataset.unstoredTheme = next;
    }
    paint(storageKey, colors, next);
  });
}
