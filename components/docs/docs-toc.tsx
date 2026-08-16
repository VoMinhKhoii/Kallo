'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { TocEntry } from '@/lib/docs/toc';
import { cn } from '@/lib/utils';

/**
 * The "on this page" rail, with scroll-spy.
 *
 * The observer's bottom margin pulls the trigger line up near the header, so a
 * heading becomes current as it reaches the top of the viewport rather than
 * when it first peeks in from the bottom. Among the headings currently
 * intersecting we take the topmost, which keeps short sections from flickering
 * past without ever being marked.
 */
export function DocsToc({ entries }: { entries: TocEntry[] }) {
  const t = useTranslations('docs');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;

    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((el) => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    for (const heading of headings) {
      observer.observe(heading);
    }

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-labelledby="docs-toc-heading">
      <p
        className="font-sans-display font-semibold text-2xs text-kallo-text-muted uppercase tracking-[0.14em]"
        id="docs-toc-heading"
      >
        {t('onThisPage')}
      </p>
      <ul className="mt-3 space-y-1.5 border-kallo-border border-l">
        {entries.map((entry) => {
          const isActive = activeId === entry.id;

          return (
            <li key={entry.id}>
              <a
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l py-0.5 font-sans-display text-2xs leading-snug transition-colors',
                  entry.depth === 3 ? 'pl-6' : 'pl-3',
                  isActive
                    ? 'border-kallo-accent font-semibold text-kallo-text'
                    : 'border-transparent text-kallo-text-muted hover:text-kallo-text'
                )}
                href={`#${entry.id}`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
