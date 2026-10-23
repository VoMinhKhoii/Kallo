'use client';

import { useSyncExternalStore } from 'react';
import {
  readResolvedTheme,
  readThemeChoice,
  subscribeTheme,
  writeThemeChoice,
} from '@/lib/core/theme/theme-store';
import type { AppTheme, ThemeChoice } from '@/lib/core/theme/themes';

/**
 * The Settings → Appearance choice and its setter. The server render (and
 * hydration) sees `system`; the stored value takes over right after, so the
 * markup matches.
 */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(
    subscribeTheme,
    readThemeChoice,
    () => 'system' as const
  );
  return [choice, writeThemeChoice];
}

/** The theme being painted: the choice with System resolved against the OS. */
export function useResolvedTheme(): AppTheme {
  return useSyncExternalStore(
    subscribeTheme,
    readResolvedTheme,
    () => 'light' as const
  );
}
