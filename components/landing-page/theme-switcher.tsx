'use client';

import { useTranslations } from 'next-intl';
import { THEME_ICONS } from '@/components/settings/appearance/theme-icons';
import { ThemeMenuRadio } from '@/components/settings/appearance/theme-menu-radio';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeChoice } from '@/hooks/theme/use-theme-choice';

/**
 * The header's theme switch: an icon showing the current choice, opening the
 * same four segments the app's account menu offers. The choice is the app's
 * own (one stored value per device), so a visitor who picks Aurora here signs
 * in to Aurora.
 */
export function ThemeSwitcher() {
  const t = useTranslations('settings.appearance');
  const [theme] = useThemeChoice();
  const Icon = THEME_ICONS[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('label')}
        title={t('label')}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-kallo-text-soft transition-colors hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
      >
        <Icon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl border border-kallo-text/10 bg-card p-1.5 font-sans-display shadow-lg"
      >
        <ThemeMenuRadio />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
