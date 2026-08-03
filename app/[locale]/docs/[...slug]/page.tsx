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
    <div className="flex gap-10">
      <article className="min-w-0 max-w-[36rem] flex-1 py-10">
        <DocsBreadcrumbs sectionId={section.id} />

        <h1 className="mt-3 text-balance font-normal font-serif text-h2 text-nham-text">
          {frontmatter.title}
        </h1>
        <p className="mt-4 text-pretty text-base text-nham-text-muted leading-relaxed">
          {frontmatter.description}
        </p>
        {frontmatter.lastUpdated && (
          <LastUpdated date={frontmatter.lastUpdated} locale={locale} />
        )}

        <div className="mt-10">
          <Content />
        </div>

        <DocsPager
          next={links.find((link) => link.slug === next)}
          previous={links.find((link) => link.slug === previous)}
        />
      </article>

      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 overflow-y-auto py-10 xl:block">
        <DocsToc entries={toc} />
      </aside>
    </div>
  );
}
