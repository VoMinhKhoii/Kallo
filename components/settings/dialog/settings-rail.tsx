'use client';

import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { SETTINGS_PAGE_ICONS } from '@/components/settings/chrome/page-icons';
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
 * The desktop dialog's left rail: "Settings" on top, page links with their
 * icons grouped by space alone (no labels), Send feedback pinned to the foot.
 * Its top and bottom padding match the page pane's, so the two titles line up. The selected page wears the beige wash; a hovered one lifts to white.
 */
export function SettingsRail({
  current,
  onShow,
  hasProfile,
}: SettingsRailProps) {
  const t = useTranslations('settings');

  const item = (page: SettingsPageId) => {
    const Icon = SETTINGS_PAGE_ICONS[page];
    return (
      <li key={page}>
        <button
          type="button"
          onClick={() => onShow(page)}
          aria-current={page === current ? 'page' : undefined}
          className={cn(
            'flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent',
            page === current
              ? 'bg-kallo-hover font-medium text-kallo-text'
              : 'text-kallo-text-muted hover:bg-card hover:text-kallo-text'
          )}
        >
          <Icon
            className="size-[18px] shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {t(`pages.${page}.title`)}
        </button>
      </li>
    );
  };

  return (
    <nav
      aria-label={t('title')}
      className="flex w-[244px] shrink-0 flex-col border-kallo-border border-r bg-kallo-track px-2.5 pt-7 pb-7 dark:bg-sidebar"
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
