'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { THEME_ICONS } from '@/components/settings/appearance/theme-icons';
import {
  useResolvedTheme,
  useThemeChoice,
} from '@/hooks/theme/use-theme-choice';

/**
 * The header's theme switch: one click between light and dark. Aurora counts
 * as dark here, so a visitor who picked it in the app can still flip out of it.
 */
export function ThemeSwitcher() {
  const t = useTranslations('settings.appearance');
  const [, setTheme] = useThemeChoice();
  const isLight = useResolvedTheme() === 'light';
  const Icon = THEME_ICONS[isLight ? 'light' : 'dark'];
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Hands the click over from the early listener in `ThemeScript`.
  useEffect(() => {
    if (buttonRef.current) buttonRef.current.dataset.hydrated = 'true';
  }, []);

  return (
    <button
      ref={buttonRef}
      data-theme-toggle=""
      type="button"
      aria-label={t('label')}
      aria-pressed={!isLight}
      title={t('label')}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-kallo-text-soft transition-colors hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-text/40"
    >
      <Icon className="size-icon-inline" aria-hidden="true" />
    </button>
  );
}
