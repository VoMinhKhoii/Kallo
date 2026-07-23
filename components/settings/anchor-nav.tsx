'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
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
 * section, so its entry is filtered out for them. A scroll-spy marks the
 * section currently in view.
 */
export function SettingsAnchorNav({
  hasProfile = true,
}: SettingsAnchorNavProps) {
  const t = useTranslations('settings.anchorNav');
  const [activeId, setActiveId] = useState<string>(PROFILE_ANCHOR);

  const items = hasProfile
    ? ANCHORS
    : ANCHORS.filter((item) => item.id !== PREFERENCES_ANCHOR);

  useEffect(() => {
    const sections = ANCHORS.map((item) =>
      document.getElementById(item.id)
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    // The section whose top most recently crossed the upper third of the
    // viewport wins; the last section wins once the page is scrolled out.
    const pick = () => {
      const threshold = window.innerHeight / 3;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= threshold) {
          current = section.id;
        }
      }
      setActiveId(current);
    };

    pick();
    // The app shell scrolls an inner container, not the window — scroll
    // events don't bubble, so listen in the capture phase to catch them all.
    window.addEventListener('scroll', pick, { passive: true, capture: true });
    window.addEventListener('resize', pick);
    return () => {
      window.removeEventListener('scroll', pick, { capture: true });
      window.removeEventListener('resize', pick);
    };
  }, []);

  const handleJump = (id: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    setActiveId(id);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      aria-label={t('label')}
      className="font-sans-display lg:sticky lg:top-3"
    >
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              onClick={handleJump(item.id)}
              aria-current={activeId === item.id ? 'true' : undefined}
              className={cn(
                'block whitespace-nowrap rounded-xl px-3 py-2 font-medium text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent',
                activeId === item.id
                  ? 'bg-nham-hover/50 font-semibold text-nham-text'
                  : 'text-[#7B6F62] hover:bg-nham-hover/50 hover:text-nham-text'
              )}
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
