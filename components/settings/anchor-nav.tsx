'use client';

import { useTranslations } from 'next-intl';
import {
  ACCOUNT_ANCHOR,
  FEEDBACK_ANCHOR,
  PREFERENCES_ANCHOR,
  PROFILE_ANCHOR,
} from './anchors';

interface AnchorItem {
  id: string;
  labelKey: string;
}

const ANCHORS: readonly AnchorItem[] = [
  { id: PROFILE_ANCHOR, labelKey: 'profile' },
  { id: PREFERENCES_ANCHOR, labelKey: 'preferences' },
  { id: FEEDBACK_ANCHOR, labelKey: 'feedback' },
  { id: ACCOUNT_ANCHOR, labelKey: 'account' },
] as const;

interface SettingsAnchorNavProps {
  hasProfile?: boolean;
}

/**
 * Settings anchor nav — replaces the old routed master-detail sidebar. Jumps
 * to a stacked section on the single scrollable settings page. On large
 * screens it sits beside the content; on small screens it's a horizontal
 * scroller above the sections. Profile-less users don't get a Preferences
 * section, so its entry is filtered out for them.
 */
export function SettingsAnchorNav({
  hasProfile = true,
}: SettingsAnchorNavProps) {
  const t = useTranslations('settings.anchorNav');

  const items = hasProfile
    ? ANCHORS
    : ANCHORS.filter((item) => item.id !== PREFERENCES_ANCHOR);

  const handleJump = (id: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      aria-label={t('label')}
      className="font-sans-display lg:sticky lg:top-3"
    >
      <p className="hidden px-3 pb-2 font-medium text-[#7B6F62] text-[11px] uppercase tracking-[0.12em] lg:block">
        {t('label')}
      </p>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              onClick={handleJump(item.id)}
              className="block whitespace-nowrap rounded-xl px-3 py-2 font-medium text-[#7B6F62] text-[14px] transition-colors hover:bg-nham-hover/50 hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
            >
              {t(item.labelKey)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { ACCOUNT_ANCHOR, FEEDBACK_ANCHOR };
