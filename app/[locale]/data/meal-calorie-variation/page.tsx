import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { LazyAuthDialog } from '@/components/auth/lazy-auth-dialog';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsH2, DocsParagraph } from '@/components/docs/mdx/prose';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { KindList } from '@/components/seo/meal-data/kind-list';
import { SwingList } from '@/components/seo/meal-data/swing-list';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGE_LOCALES, isFoodLocale } from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_COPY } from '@/lib/seo/meal-data/copy';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The food pages read together: how far the same dish swings, what moves
 * it, and how often Kallo counts cooking oil nobody typed. Original data for
 * other sites to cite, in each locale that has food pages, from that locale's
 * own dishes. Every number is computed from the committed captures.
 */
interface MealDataProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return FOOD_PAGE_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: MealDataProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isFoodLocale(locale)) return {};
  const copy = MEAL_DATA_COPY[locale];
  const { facts } = mealData(locale);
  const url = `${SITE_URL}/${locale}${MEAL_DATA_PATH}`;
  return {
    title: copy.metaTitle(facts),
    description: copy.description(facts),
    alternates: {
      canonical: url,
      languages: alternateLanguages(MEAL_DATA_PATH),
    },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: copy.metaTitle(facts),
      description: copy.description(facts),
    },
  };
}

export default function MealDataPage({ params }: MealDataProps) {
  return (
    <Suspense fallback={null}>
      <MealDataContent params={params} />
    </Suspense>
  );
}

async function MealDataContent({ params }: MealDataProps) {
  const { locale } = await params;
  if (!isFoodLocale(locale)) notFound();
  const copy = MEAL_DATA_COPY[locale];
  const { facts, swings, kinds } = mealData(locale);
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const url = `${SITE_URL}/${locale}${MEAL_DATA_PATH}`;

  return (
    <AuthProvider>
      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {copy.title}
          </h1>
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <DocsParagraph>{copy.lead(facts)}</DocsParagraph>

          <DocsH2>{copy.swingsHeading}</DocsH2>
          <DocsParagraph>{copy.swingsLead}</DocsParagraph>
          <SwingList locale={locale} swings={swings.slice(0, 10)} />

          <DocsH2>{copy.kindsHeading}</DocsH2>
          <DocsParagraph>{copy.kindsLead}</DocsParagraph>
          <KindList kinds={kinds} locale={locale} />

          <DocsH2>{copy.oilHeading}</DocsH2>
          <DocsParagraph>{copy.oilBody(facts)}</DocsParagraph>

          <DocsH2>{copy.steadyHeading}</DocsH2>
          <DocsParagraph>{copy.steadyLead}</DocsParagraph>
          <SwingList locale={locale} swings={swings.slice(-5).reverse()} />

          <DocsH2>{copy.methodHeading}</DocsH2>
          {copy.method(facts).map((p) => (
            <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
          ))}

          <DocsH2>{copy.citeHeading}</DocsH2>
          <DocsParagraph>{copy.cite(facts, url)}</DocsParagraph>

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
