'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import type { DocsNavSection } from '@/lib/docs/tree';
import { cn } from '@/lib/utils';

/**
 * The docs table of contents rail.
 *
 * Text-only by design: the brand's icon allowance is small, and a column of
 * seven section icons would spend all of it on decoration. Selection follows
 * the one hover/press recipe used everywhere else in the product — the beige
 * `nham-hover` wash plus ink text plus semibold weight. No filled umber row,
 * no pill, no accent-coloured background.
 *
 * `usePathname` here is the next-intl one, so it is already locale-stripped
 * and compares directly against `/docs/<slug>`.
 */
export function DocsSidebar({
  sections,
  onNavigate,
}: {
  sections: DocsNavSection[];
  /** Lets the mobile drawer close itself when a link is followed. */
  onNavigate?: () => void;
}) {
  const t = useTranslations('docs.sections');
  const pathname = usePathname();

  return (
    <nav className="space-y-7">
      {sections.map((section) => (
        <div key={section.id}>
          <p className="px-3 font-sans-display font-semibold text-[11px] text-nham-text-muted uppercase tracking-[0.14em]">
            {t(section.id)}
          </p>
          <ul className="mt-2 space-y-px">
            {section.links.map((link) => {
              const href = `/docs/${link.slug}`;
              const isActive = pathname === href;

              return (
                <li key={link.slug}>
                  <Link
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-1.5 font-sans-display text-[13.5px] leading-snug transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent',
                      isActive
                        ? 'bg-nham-hover font-semibold text-nham-text'
                        : 'text-nham-text-muted hover:bg-nham-hover hover:text-nham-text'
                    )}
                    href={href}
                    onClick={onNavigate}
                  >
                    {link.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
