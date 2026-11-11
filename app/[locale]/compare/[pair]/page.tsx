import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { LazyAuthDialog } from '@/components/auth/lazy-auth-dialog';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import {
  DocsH2,
  DocsLink,
  DocsListItem,
  DocsParagraph,
  DocsUnorderedList,
} from '@/components/docs/mdx/prose';
import { SourceLine } from '@/components/seo/alternatives/option-section';
import { CompareTable } from '@/components/seo/compare/compare-table';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { JsonLd } from '@/components/seo/json-ld';
import { alternativePath } from '@/lib/seo/alternatives/slugs';
import { COMPARE_CHROME } from '@/lib/seo/compare/chrome';
import { COMPARE_PAGES } from '@/lib/seo/compare/pages';
import {
  COMPARE_LOCALE,
  COMPARE_SLUGS,
  comparePath,
  isCompareSlug,
} from '@/lib/seo/compare/slugs';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { alternativesStructuredData } from '@/lib/seo/page-structured-data';
import { SITE_URL } from '@/lib/seo/site';

/**
 * A "Kallo vs <app>" page: the answer, the two apps side by side, how each
 * logs a meal, when to pick which, Kallo's own data, and the sources. English
 * only. Copy lives in `lib/seo/compare/<slug>.ts`.
 *
 * An unknown slug or a Vietnamese URL gets its real 404 from the proxy
 * (`unknownComparePageTarget`); `notFound()` here is the backstop.
 */
interface ComparePageProps {
  params: Promise<{ locale: string; pair: string }>;
}

// Deliberately blocking, like the tool and alternatives pages: inside a
// `<Suspense>` for its params, React would outline the article into a hidden
// block after the footer, and crawlers that run no JavaScript would read an
// empty page.
export const instant = false;

export function generateStaticParams() {
  return COMPARE_SLUGS.map((pair) => ({ locale: COMPARE_LOCALE, pair }));
}

function pageOf(locale: string, pair: string) {
  return locale === COMPARE_LOCALE && isCompareSlug(pair)
    ? { slug: pair, copy: COMPARE_PAGES[pair] }
    : null;
}

export async function generateMetadata({
  params,
}: ComparePageProps): Promise<Metadata> {
  const { locale, pair } = await params;
  const page = pageOf(locale, pair);
  if (!page) return {};
  const url = `${SITE_URL}/${locale}${comparePath(page.slug)}`;
  return {
    title: page.copy.metaTitle,
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

function PickList({ heading, items }: { heading: string; items: string[] }) {
  return (
    <>
      <DocsH2>{heading}</DocsH2>
      <DocsUnorderedList>
        {items.map((item) => (
          <DocsListItem key={item}>{item}</DocsListItem>
        ))}
      </DocsUnorderedList>
    </>
  );
}

export default async function KalloVsPage({ params }: ComparePageProps) {
  const { locale, pair } = await params;
  const page = pageOf(locale, pair);
  if (!page) notFound();
  const { copy } = page;
  const { facts } = mealData(COMPARE_LOCALE);
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const url = `${SITE_URL}/${locale}${comparePath(page.slug)}`;

  return (
    <AuthProvider>
      <JsonLd
        data={alternativesStructuredData({
          locale,
          url,
          title: copy.title,
          description: copy.description,
          checkedOn: copy.checkedOn,
        })}
      />
      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {copy.title}
          </h1>
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <DocsParagraph>{copy.answer}</DocsParagraph>
          <p className="mt-4 text-kallo-text-muted text-sm leading-[1.75]">
            {copy.disclosure}
          </p>

          <CompareTable page={copy} />

          {copy.sections.map((section) => (
            <section key={section.heading}>
              <DocsH2>{section.heading}</DocsH2>
              {section.body.map((p) => (
                <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
              ))}
            </section>
          ))}

          <PickList
            heading={COMPARE_CHROME.pickThem(copy.them)}
            items={copy.pickThem}
          />
          <PickList heading={COMPARE_CHROME.pickKallo} items={copy.pickKallo} />

          <DocsH2>{copy.dataHeading}</DocsH2>
          <DocsParagraph>
            {copy.data(facts)}{' '}
            <DocsLink href={MEAL_DATA_PATH}>{COMPARE_CHROME.dataLink}</DocsLink>
          </DocsParagraph>

          <DocsParagraph>
            <DocsLink href={alternativePath(copy.alternatives)}>
              {COMPARE_CHROME.alternativesLink(copy.them)}
            </DocsLink>
          </DocsParagraph>

          <DocsH2>{COMPARE_CHROME.methodHeading}</DocsH2>
          {copy.method.map((p) => (
            <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
          ))}
          <SourceLine sources={copy.sources} />

          <div className="mt-16 border-kallo-text border-t pt-10 text-center">
            <DocsParagraph>{copy.tryLine}</DocsParagraph>
            <div className="mt-6">
              <TryItButton>{t('getStarted')}</TryItButton>
            </div>
          </div>
        </div>
      </article>
      <LazyAuthDialog />
      <Suspense fallback={null}>
        <AuthRequestConfig />
      </Suspense>
    </AuthProvider>
  );
}
