import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsH2, DocsLink, DocsParagraph } from '@/components/docs/mdx/prose';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { pagesOf } from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_PAGE_PREFIX,
  type FoodLocale,
  isFoodLocale,
} from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_COPY, type MealDataFacts } from '@/lib/seo/meal-data/copy';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import {
  hiddenOil,
  ingredientStats,
  type MealSwing,
  mealSwings,
  median,
} from '@/lib/seo/meal-data/stats';
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

function factsOf(locale: FoodLocale): MealDataFacts {
  const swings = mealSwings(locale);
  const oil = hiddenOil(locale);
  const chrome = FOOD_PAGE_CHROME[locale];
  const days = pagesOf(locale)
    .map((p) => p.capture.capturedAt)
    .sort();
  const ratio = median(swings.map((s) => Math.round(s.ratio * 10))) / 10;
  return {
    meals: oil.total,
    dishes: swings.length,
    ratio: ratio.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    withOil: oil.withOil,
    unnamed: oil.unnamed,
    oilKcal: oil.medianKcal,
    dates: {
      from: chrome.formatDate(new Date(days[0])),
      to: chrome.formatDate(new Date(days.at(-1) as string)),
    },
  };
}

export async function generateMetadata({
  params,
}: MealDataProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isFoodLocale(locale)) return {};
  const copy = MEAL_DATA_COPY[locale];
  const facts = factsOf(locale);
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

function SwingList({
  swings,
  locale,
}: {
  swings: MealSwing[];
  locale: FoodLocale;
}) {
  const { formatNumber } = FOOD_PAGE_CHROME[locale];
  const copy = MEAL_DATA_COPY[locale];
  return (
    <ul className="mt-5 divide-y divide-kallo-border/60 border-kallo-border/60 border-y">
      {swings.map((s) => (
        <li className="py-3" key={s.page.slug}>
          <div className="flex items-baseline justify-between gap-4">
            <DocsLink href={`${FOOD_PAGE_PREFIX}/${s.page.slug}`}>
              {s.page.name}
            </DocsLink>
            <span className="shrink-0 text-kallo-text tabular-nums">
              {formatNumber(s.low)}–{formatNumber(s.high)} kcal ·{' '}
              {(Math.round(s.ratio * 10) / 10).toLocaleString(
                locale === 'vi' ? 'vi-VN' : 'en-US'
              )}
              ×
            </span>
          </div>
          <p className="mt-1 text-kallo-text-muted text-sm">
            {copy.swingLine(s.lowLabel, s.highLabel)}
          </p>
        </li>
      ))}
    </ul>
  );
}

async function MealDataContent({ params }: MealDataProps) {
  const { locale } = await params;
  if (!isFoodLocale(locale)) notFound();
  const copy = MEAL_DATA_COPY[locale];
  const facts = factsOf(locale);
  const swings = mealSwings(locale);
  const { formatNumber } = FOOD_PAGE_CHROME[locale];
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
          <ul className="mt-5 divide-y divide-kallo-border/60 border-kallo-border/60 border-y">
            {ingredientStats(locale).map((k) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-x-4 py-3"
                key={k.key}
              >
                <span className="font-sans-display text-kallo-text">
                  {copy.kinds[k.key] ?? k.key}
                </span>
                <span className="text-kallo-text-muted text-sm tabular-nums">
                  {copy.kindLine(
                    k.meals,
                    formatNumber(k.medianKcal),
                    formatNumber(k.maxKcal)
                  )}
                </span>
              </li>
            ))}
          </ul>

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
      <AuthDialog />
      <Suspense fallback={null}>
        <AuthRequestConfig />
      </Suspense>
    </AuthProvider>
  );
}
