import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { DocsBreadcrumbs } from '@/components/docs/docs-breadcrumbs';
import { DocsPager } from '@/components/docs/docs-pager';
import { DocsToc } from '@/components/docs/docs-toc';
import { LastUpdated } from '@/components/docs/last-updated';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/navigation';
import { loadDoc } from '@/lib/docs/loader';
import {
  DOCS_SLUGS,
  findSectionForSlug,
  getNeighbours,
} from '@/lib/docs/navigation';
import { getToc } from '@/lib/docs/toc';
import { getDocsLinks } from '@/lib/docs/tree';
import { SITE_URL } from '@/lib/site';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    DOCS_SLUGS.map((slug) => ({ locale, slug: slug.split('/') }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const path = slug.join('/');
  const doc = await loadDoc(locale as Locale, path);

  if (!doc) return {};

  const url = `${SITE_URL}/${locale}/docs/${path}`;

  return {
    title: `${doc.frontmatter.title} — Kallo`,
    description: doc.frontmatter.description,
    // The locale layout deliberately sets no shared openGraph.url, so each
    // page has to declare its own or it inherits the locale root as canonical.
    alternates: { canonical: url },
    openGraph: {
      url,
      title: doc.frontmatter.title,
      description: doc.frontmatter.description,
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const path = slug.join('/');
  const doc = await loadDoc(locale as Locale, path);
  const section = findSectionForSlug(path);

  if (!(doc && section)) {
    notFound();
  }

  const { default: Content, frontmatter } = doc;
  const toc = await getToc(locale as Locale, path);

  const links = await getDocsLinks(locale as Locale);
  const { previous, next } = getNeighbours(path);

  return (
    // Three tracks of equal outer width, so the measure sits centred on the
    // SCREEN rather than centred in whatever the rail leaves over. The left
    // track is an empty spacer that exists only to balance the rail; without
    // it the reading column drifts left by half the rail's width.
    <div className="xl:grid xl:grid-cols-[14rem_minmax(0,40rem)_14rem] xl:justify-center xl:gap-10">
      <div aria-hidden="true" className="hidden xl:block" />

      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10 xl:mx-0">
        <DocsBreadcrumbs sectionId={section.id} />

        {/* Centred header block: title, revision stamp, rule. The rule is the
            page's one horizontal division — everything above it is masthead,
            everything below is the document, so it is full-strength ink
            rather than the hairline used between rows. */}
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-nham-text">
            {frontmatter.title}
          </h1>
          <LastUpdated date={frontmatter.lastUpdated} locale={locale} />
        </div>

        <hr className="mt-8 border-nham-text border-t" />

        <div className="mt-10">
          <Content />
        </div>

        <DocsPager
          next={links.find((link) => link.slug === next)}
          previous={links.find((link) => link.slug === previous)}
        />
      </article>

      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-10 xl:block">
        <DocsToc entries={toc} />
      </aside>
    </div>
  );
}
