'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  PINNED_SETTINGS_PAGE,
  type SettingsPageId,
  visibleSettingsGroups,
} from '@/lib/domain/settings/pages';

interface SettingsMenuProps {
  onShow: (page: SettingsPageId) => void;
  hasProfile: boolean;
}

/**
 * The phone sheet's first level: the rail's groups as hairline cards of rows,
 * each pushing its page in. Send feedback gets a card of its own at the end.
 */
export function SettingsMenu({ onShow, hasProfile }: SettingsMenuProps) {
  const t = useTranslations('settings');
  const groups = [...visibleSettingsGroups(hasProfile), [PINNED_SETTINGS_PAGE]];

  return (
    <>
      {/* The dialog's accessible title is the sheet's own; this is the
          large heading the page list opens under. */}
      <p
        aria-hidden="true"
        className="mt-1 mb-5 font-serif text-[28px] text-kallo-text leading-tight tracking-tight"
      >
        {t('title')}
      </p>
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <ul
            key={group.join()}
            className="divide-y divide-kallo-border overflow-hidden rounded-2xl border border-kallo-border bg-card"
          >
            {group.map((page) => (
              <li key={page}>
                <button
                  type="button"
                  onClick={() => onShow(page)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-[16px] text-kallo-text transition-colors focus-visible:bg-kallo-hover focus-visible:outline-none active:bg-kallo-hover"
                >
                  {t(`pages.${page}.title`)}
                  <ChevronRight
                    className="size-4 text-kallo-text-muted"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </>
  );
}
