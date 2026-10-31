'use client';

import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { dialogShell } from '@/components/shared/dialog-shell/dialog-shell';
import { cn } from '@/lib/core/ui/cn';
import {
  PINNED_SETTINGS_PAGE,
  type SettingsPageId,
  visibleSettingsGroups,
} from '@/lib/domain/settings/pages';

interface SettingsRailProps {
  current: SettingsPageId;
  onShow: (page: SettingsPageId) => void;
  hasProfile: boolean;
}

/**
 * The desktop dialog's left rail: "Settings" on top, text-only page links
 * grouped by space alone (no labels, no icons), Send feedback pinned to the
 * foot. The selected page wears the beige wash; a hovered one lifts to white.
 */
export function SettingsRail({
  current,
  onShow,
  hasProfile,
}: SettingsRailProps) {
  const t = useTranslations('settings');

  const item = (page: SettingsPageId) => (
    <li key={page}>
      <button
        type="button"
        onClick={() => onShow(page)}
        aria-current={page === current ? 'page' : undefined}
        className={cn(
          'flex h-9 w-full items-center rounded-lg px-3 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent',
          page === current
            ? 'bg-kallo-hover font-medium text-kallo-text'
            : 'text-kallo-text-muted hover:bg-card hover:text-kallo-text'
        )}
      >
        {t(`pages.${page}.title`)}
      </button>
    </li>
  );

  return (
    <nav
      aria-label={t('title')}
      className="flex w-[244px] shrink-0 flex-col border-kallo-border border-r bg-kallo-track px-2.5 pt-5 pb-3 dark:bg-sidebar"
    >
      <DialogPrimitive.Title className={cn(dialogShell.title, 'px-3 pb-4')}>
        {t('title')}
      </DialogPrimitive.Title>
      <div className="flex flex-col gap-4">
        {visibleSettingsGroups(hasProfile).map((group) => (
          <ul key={group.join()} className="flex flex-col gap-0.5">
            {group.map(item)}
          </ul>
        ))}
      </div>
      <ul className="mt-auto">{item(PINNED_SETTINGS_PAGE)}</ul>
    </nav>
  );
}
