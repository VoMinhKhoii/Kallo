import {
  type AppTheme,
  isThemeChoice,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from './themes';

/**
 * The Settings → Appearance choice, kept in localStorage and nowhere else.
 *
 * There is deliberately no in-memory copy: Next keeps pages mounted (hidden)
 * across navigations, so a copy held by one page's tree would go stale while
 * the user changed the theme on another page and come back wrong when revealed.
 * Every reader reads storage; writers notify subscribers.
 */
const listeners = new Set<() => void>();
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** The theme the choice paints right now (System resolved against the OS). */
export function readResolvedTheme(): AppTheme {
  const choice = readThemeChoice();
  if (choice !== 'system') return choice;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the switch still happens for this page view.
  }
  suspendTransitions();
  for (const listener of listeners) listener();
}

/** Calls back on a choice written here, in another tab, or an OS switch. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', listener);
  };
}

/** Every surface swaps colour in the same frame, with no half-faded mix. */
function suspendTransitions() {
  const style = document.createElement('style');
  style.textContent =
    '*,*::before,*::after{transition:none!important;animation-duration:0s!important}';
  document.head.append(style);
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
}
