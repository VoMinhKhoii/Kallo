import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsH2, DocsLink, DocsParagraph } from '@/components/docs/mdx/prose';
import {
  OptionSection,
  SourceLine,
} from '@/components/seo/alternatives/option-section';
import { OptionsTable } from '@/components/seo/alternatives/options-table';
import { VendorArticle } from '@/components/seo/vendor-article';
import { ALTERNATIVE_PAGES } from '@/lib/seo/alternatives/pages';
import {
  ALTERNATIVE_SLUGS,
  ALTERNATIVES_LOCALE,
  alternativePath,
  isAlternativeSlug,
} from '@/lib/seo/alternatives/slugs';
import { COMPARE_CHROME } from '@/lib/seo/compare/chrome';
import { COMPARE_PAGES, compareSlugFor } from '@/lib/seo/compare/pages';
import { comparePath } from '@/lib/seo/compare/slugs';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * An "alternatives to <app>" page: the answer first, a table of every app,
 * then one section per app with its sources, and Kallo's own data. English
 * only. Copy lives in `lib/seo/alternatives/<slug>.ts`.
 *
 * An unknown slug or a Vietnamese URL gets its real 404 from the proxy
 * (`unknownAlternativePageTarget`); `notFound()` here is the backstop.
 */
interface AlternativesPageProps {
  params: Promise<{ locale: string; app: string }>;
}

// Deliberately blocking, like the tool pages: inside a `<Suspense>` for its
// params, React would outline the article into a hidden block after the
// footer, and crawlers that run no JavaScript would read an empty page.
export const instant = false;

export function generateStaticParams() {
  return ALTERNATIVE_SLUGS.map((app) => ({ locale: ALTERNATIVES_LOCALE, app }));
}

function pageOf(locale: string, app: string) {
  return locale === ALTERNATIVES_LOCALE && isAlternativeSlug(app)
    ? { slug: app, copy: ALTERNATIVE_PAGES[app] }
    : null;
}

export async function generateMetadata({
  params,
}: AlternativesPageProps): Promise<Metadata> {
  const { locale, app } = await params;
  const page = pageOf(locale, app);
  if (!page) return {};
  const url = `${SITE_URL}/${locale}${alternativePath(page.slug)}`;
  return {
    // Absolute: the brand suffix would push the title past what Google shows,
    // and nobody searches for these pages by the brand.
    title: { absolute: page.copy.metaTitle },
    description: page.copy.description,
    alternates: { canonical: url },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: page.copy.metaTitle,
      description: page.copy.description,
    },
  };
}

export default async function AlternativesPage({
  params,
}: AlternativesPageProps) {
  const { locale, app } = await params;
  const page = pageOf(locale, app);
  if (!page) notFound();
  const { copy } = page;
  const { facts } = mealData(ALTERNATIVES_LOCALE);
  const url = `${SITE_URL}/${locale}${alternativePath(page.slug)}`;
  const vs = compareSlugFor(page.slug);

  return (
    <VendorArticle
      answer={copy.answer}
      checkedOn={copy.checkedOn}
      publishedOn={copy.publishedOn}
      description={copy.description}
      disclosure={copy.disclosure}
      locale={locale}
      title={copy.title}
      tryLine={copy.tryLine}
      url={url}
    >
      <OptionsTable options={copy.options} />

      <DocsH2>{copy.leaveHeading}</DocsH2>
      {copy.leave.map((p) => (
        <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
      ))}
      <SourceLine sources={copy.leaveSources} />

      {copy.options.map((option) => (
        <OptionSection key={option.name} option={option} />
      ))}

      {copy.extra ? (
        <>
          <DocsH2>{copy.extra.heading}</DocsH2>
          {copy.extra.body.map((p) => (
            <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
          ))}
        </>
      ) : null}

      {vs ? (
        <DocsParagraph>
          <DocsLink href={comparePath(vs)}>
            {COMPARE_CHROME.compareLink(COMPARE_PAGES[vs].them)}
          </DocsLink>
        </DocsParagraph>
      ) : null}

      <DocsH2>{copy.dataHeading}</DocsH2>
      <DocsParagraph>
        {copy.data(facts)}{' '}
        <DocsLink href={MEAL_DATA_PATH}>{copy.dataLink}</DocsLink>
      </DocsParagraph>

      <DocsH2>{copy.methodHeading}</DocsH2>
      {copy.method.map((p) => (
        <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
      ))}
    </VendorArticle>
  );
}
