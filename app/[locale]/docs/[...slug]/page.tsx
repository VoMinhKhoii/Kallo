import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { DocsBreadcrumbs } from '@/components/docs/docs-breadcrumbs';
import { DocsPager } from '@/components/docs/docs-pager';
import { DocsToc } from '@/components/docs/docs-toc';
import { LastUpdated } from '@/components/docs/last-updated';
import { routing } from '@/i18n/navigation';
import { loadDoc } from '@/lib/domain/docs/loader';
import {
  DOCS_SLUGS,
  findSectionForSlug,
  getNeighbours,
} from '@/lib/domain/docs/navigation';
import { getToc } from '@/lib/domain/docs/toc';
import { getDocsLinks } from '@/lib/domain/docs/tree';
import { alternateLanguages } from '@/lib/seo/alternates';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

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
  if (!hasLocale(routing.locales, locale)) return {};

  const path = slug.join('/');
  const doc = await loadDoc(locale, path);

  if (!doc) return {};

  const url = `${SITE_URL}/${locale}/docs/${path}`;

  return {
    title: `${doc.frontmatter.title} — Kallo`,
    description: doc.frontmatter.description,
    // The locale layout deliberately sets no shared openGraph.url, so each
    // page has to declare its own or it inherits the locale root as canonical.
    alternates: {
      canonical: url,
      // Every slug is guaranteed to exist in both locales by
      // generateStaticParams, so the hreflang set is always complete.
      languages: alternateLanguages(`/docs/${path}`),
      // The Markdown representation of this same page. It is also served from
      // the canonical URL to `Accept: text/markdown`, but a crawler that does
      // not negotiate needs a plain link to follow, and this is the one Next
      // renders as `<link rel="alternate" type="text/markdown">`.
      types: { 'text/markdown': `${url}.md` },
    },
    openGraph: {
      // Spread, not a bare `{ url, title, description }`: declaring `openGraph`
      // replaces the layout's object rather than extending it, so without this
      // every docs page shares with no preview image — which is what shipped.
      ...SHARED_OPEN_GRAPH,
      url,
      title: doc.frontmatter.title,
      description: doc.frontmatter.description,
      locale,
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  // Narrow the URL segment once. Every downstream call wants the union, and
  // three separate `as Locale` casts would each be an unchecked promise that
  // the segment is one of ours.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const path = slug.join('/');
  const doc = await loadDoc(locale, path);
  const section = findSectionForSlug(path);

  if (!(doc && section)) {
    notFound();
  }

  const { default: Content, frontmatter } = doc;
  const toc = await getToc(locale, path);

  const links = await getDocsLinks(locale);
  const { previous, next } = getNeighbours(path);

  return (
    // Three tracks of equal outer width, so the measure sits centred on the
    // SCREEN rather than centred in whatever the rail leaves over. The rail
    // takes the first track and the last is an empty spacer that exists only
    // to balance it; without the spacer the reading column drifts right by
    // half the rail's width.
    //
    // The rail is first in the DOM as well as on the left, so focus order
    // follows the visual order instead of jumping backwards out of the article
    // into it. Placing it visually with `col-start` while leaving it last in
    // the source would be the alternative, and it is the worse one: it buys a
    // marginally better screen-reader entry at the cost of a tab order that
    // moves right-to-left. `DocsToc` renders a labelled `nav` landmark, so
    // skipping past it to the article is one keystroke either way.
    <div className="xl:grid xl:grid-cols-[14rem_minmax(0,40rem)_14rem] xl:justify-center xl:gap-10">
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-10 xl:block">
        <DocsToc entries={toc} />
      </aside>

      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10 xl:mx-0">
        <DocsBreadcrumbs sectionId={section.id} />

        {/* Centred header block: title, revision stamp, rule. The rule is the
            page's one horizontal division — everything above it is masthead,
            everything below is the document, so it is full-strength ink
            rather than the hairline used between rows. */}
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {frontmatter.title}
          </h1>
          <LastUpdated date={frontmatter.lastUpdated} locale={locale} />
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <Content />
        </div>

        <DocsPager
          next={links.find((link) => link.slug === next)}
          previous={links.find((link) => link.slug === previous)}
        />
      </article>

      <div aria-hidden="true" className="hidden xl:block" />
    </div>
  );
}
