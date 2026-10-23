'use client';

import { SunMoon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { useThemeChoice } from '@/hooks/theme/use-theme-choice';
import { isThemeChoice, THEME_CHOICES } from '@/lib/core/theme/themes';
import { cn } from '@/lib/core/ui/cn';
import { THEME_ICONS } from './theme-icons';
import { SEGMENT, SEGMENT_ON, SEGMENT_TRACK } from './theme-segments';

/**
 * Appearance inside a dropdown menu: the label, then four equal icon
 * segments across the menu's width. Each segment is a menu radio item, so
 * arrow keys reach it and screen readers announce the choice; picking one
 * keeps the menu open so the new theme can be seen in place.
 */
export function ThemeMenuRadio() {
  const t = useTranslations('settings.appearance');
  const [theme, setTheme] = useThemeChoice();

  return (
    <div className="px-2 pt-1.5 pb-2">
      <span className="flex items-center gap-2.5 pb-2 text-[14px] text-kallo-text">
        <SunMoon className="size-4 shrink-0 text-kallo-text-muted" />
        {t('label')}
      </span>
      <DropdownMenuPrimitive.RadioGroup
        value={theme}
        onValueChange={(next) => {
          if (isThemeChoice(next)) setTheme(next);
        }}
        className={SEGMENT_TRACK}
      >
        {THEME_CHOICES.map((option) => {
          const Icon = THEME_ICONS[option];
          return (
            <DropdownMenuPrimitive.RadioItem
              key={option}
              value={option}
              aria-label={t(option)}
              title={t(option)}
              onSelect={(event) => event.preventDefault()}
              className={cn(
                SEGMENT,
                'h-7 w-auto flex-1 cursor-default data-[highlighted]:text-kallo-text data-[highlighted]:ring-2 data-[highlighted]:ring-kallo-accent/50',
                option === theme && SEGMENT_ON
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </DropdownMenuPrimitive.RadioItem>
          );
        })}
      </DropdownMenuPrimitive.RadioGroup>
    </div>
  );
}
