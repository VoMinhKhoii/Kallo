import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Docs → Section → Page. The current page is the last crumb and is not a
 * link, marked `aria-current` so assistive tech announces the position.
 * Rendered above the title, in muted ink, so it reads as location rather than
 * as content.
 */
export function DocsBreadcrumbs({ sectionId }: { sectionId: string }) {
  const t = useTranslations('docs');
  const tSections = useTranslations('docs.sections');

  return (
    <nav aria-label={t('breadcrumb.label')}>
      <ol className="flex flex-wrap items-center gap-x-2 font-sans-display text-caption text-nham-text-muted">
        <li>
          <Link
            className="rounded-sm transition-colors hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
            href="/docs"
          >
            {t('breadcrumb.home')}
          </Link>
        </li>
        <li aria-hidden="true">·</li>
        <li aria-current="page">{tSections(sectionId)}</li>
      </ol>
    </nav>
  );
}
