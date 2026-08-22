import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Docs → Section. Two crumbs only: the section name is the last one and is not
 * a link, because the page title follows immediately below as the `h1` and
 * repeating it here would just be the same words twice.
 *
 * No `aria-current` on that last crumb — the section is not the current page,
 * so claiming it is would announce the wrong location.
 *
 * Rendered above the title, in muted ink, so it reads as location rather than
 * as content.
 */
export function DocsBreadcrumbs({ sectionId }: { sectionId: string }) {
  const t = useTranslations('docs');
  const tSections = useTranslations('docs.sections');

  return (
    <nav aria-label={t('breadcrumb.label')}>
      <ol className="flex flex-wrap items-center gap-x-2 font-sans-display text-caption text-kallo-text-muted">
        <li>
          <Link
            className="rounded-sm transition-colors hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
            href="/docs/overview"
          >
            {t('breadcrumb.home')}
          </Link>
        </li>
        <li aria-hidden="true">·</li>
        <li>{tSections(sectionId)}</li>
      </ol>
    </nav>
  );
}
