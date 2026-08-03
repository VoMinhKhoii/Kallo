import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { DocsNavSection } from '@/lib/docs/tree';

/**
 * One section of the docs home: its heading, then its pages as a hairline
 * list. A list rather than a card grid because the page titles are the
 * information — boxing each one would add chrome without adding meaning, and
 * seven grids of two-to-five cards reads as noise.
 */
export function DocsHubSection({ section }: { section: DocsNavSection }) {
  const t = useTranslations('docs.sections');

  return (
    <section>
      <h2 className="font-normal font-serif text-h4 text-nham-text">
        {t(section.id)}
      </h2>
      <ul className="mt-4 border-nham-border border-t">
        {section.links.map((link) => (
          <li className="border-nham-border border-b" key={link.slug}>
            <Link
              className="-mx-3 block rounded-lg px-3 py-3.5 transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
              href={`/docs/${link.slug}`}
            >
              <span className="font-medium font-sans-display text-[15px] text-nham-text">
                {link.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
