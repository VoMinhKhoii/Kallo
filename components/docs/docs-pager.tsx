import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { DocsNavLink } from '@/lib/docs/tree';

/**
 * Previous / next in flat reading order, crossing section boundaries so the
 * docs can be read straight through.
 *
 * Deliberately icon-free: `ArrowRight` is on the sanctioned list, but a pair
 * of arrows on every one of 21 pages is exactly the decoration the brand's
 * icon discipline exists to prevent. The small muted label above each title
 * already says which direction it goes.
 */
interface DocsPagerProps {
  previous?: DocsNavLink;
  next?: DocsNavLink;
}

export function DocsPager({ previous, next }: DocsPagerProps) {
  const t = useTranslations('docs.pager');

  if (!(previous || next)) return null;

  return (
    <nav
      aria-label={t('label')}
      className="mt-16 grid gap-3 border-nham-border border-t pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          className="group rounded-xl border border-nham-border p-card-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
          href={`/docs/${previous.slug}`}
        >
          <span className="block font-sans-display text-caption text-nham-text-muted">
            {t('previous')}
          </span>
          <span className="mt-1 block font-medium font-sans-display text-base text-nham-text">
            {previous.title}
          </span>
        </Link>
      ) : (
        // Only a spacer once there are two columns; on one column it would
        // just add an empty gap row above the next card.
        <span className="hidden sm:block" />
      )}

      {next && (
        <Link
          className="group rounded-xl border border-nham-border p-card-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent sm:col-start-2 sm:text-right"
          href={`/docs/${next.slug}`}
        >
          <span className="block font-sans-display text-caption text-nham-text-muted">
            {t('next')}
          </span>
          <span className="mt-1 block font-medium font-sans-display text-base text-nham-text">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
