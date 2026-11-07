import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { LazyAuthDialog } from '@/components/auth/lazy-auth-dialog';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsH2, DocsParagraph } from '@/components/docs/mdx/prose';
import { FoodLinkList } from '@/components/seo/food-page/food-link-list';
import { IngredientBars } from '@/components/seo/food-page/ingredient-bars';
import { LinkedSentence } from '@/components/seo/food-page/linked-sentence';
import { MealExample } from '@/components/seo/food-page/meal-example';
import { MealSummaryTable } from '@/components/seo/food-page/meal-summary-table';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { JsonLd } from '@/components/seo/json-ld';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import {
  breakdownOf,
  FOOD_PAGES,
  type FoodPage,
  kcalSpan,
  relatedPages,
  similarCaloriePages,
  sourcesOf,
} from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  foodPageKey,
  foodPagePath,
} from '@/lib/seo/food-pages/slugs';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { foodPageStructuredData } from '@/lib/seo/page-structured-data';
import { SITE_URL } from '@/lib/seo/site';
import { toolPath } from '@/lib/seo/tools/slugs';

/**
 * A public food page: one question ("how many calories in a chicken
 * burrito?") answered with real meals logged in Kallo. The copy and numbers
 * live in `lib/seo/food-pages/`; this route lays them out in the docs shell.
 *
 * Each locale has its own dishes, so a page has no language alternates. A
 * slug under another locale, or an unknown one, gets its real 404 from the
 * proxy (`unknownFoodPageTarget`); `notFound()` here is the backstop.
 */
interface FoodPageProps {
  params: Promise<{ locale: string; food: string }>;
}

// Deliberately blocking (`instant = false`): the page must not sit inside a
// `<Suspense>` for its params. React outlines a boundary over 12.8 KB, so the
// whole article shipped as a hidden block after the footer, moved into place
// by a script. Crawlers that run no JavaScript read that as an empty page.
// Every URL is prerendered (`generateStaticParams`), so the wait is a prefetch.
export const instant = false;

export function generateStaticParams() {
  return FOOD_PAGE_LOCALES.flatMap((locale) =>
    FOOD_SLUGS[locale].map((food) => ({ locale, food }))
  );
}

/** The page a URL names, or null when its locale has no such page. */
function pageAt(locale: string, food: string): FoodPage | null {
  const key = foodPageKey(locale, food);
  return key ? FOOD_PAGES[key.slug] : null;
}

export async function generateMetadata({
  params,
}: FoodPageProps): Promise<Metadata> {
  const { locale, food } = await params;
  const page = pageAt(locale, food);
  if (!page) return {};
  const url = `${SITE_URL}${foodPagePath(page.locale, page.slug)}`;
  const span = kcalSpan(page.capture, page.locale);
  const description = page.description(span);
  const title = page.metaTitle(span);
  return {
    title,
    description,
    alternates: { canonical: url },
    // Spread, not a bare object: declaring `openGraph` replaces the layout's
    // wholesale, and setting only the url would drop the preview image.
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title,
      description,
    },
  };
}

export default async function FoodPageRoute({ params }: FoodPageProps) {
  const { locale, food } = await params;
  const page = pageAt(locale, food);
  if (!page) notFound();
  const chrome = FOOD_PAGE_CHROME[page.locale];
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const loggedOn = chrome.formatDate(new Date(page.capture.capturedAt));
  const { facts } = mealData(page.locale);

  const span = kcalSpan(page.capture, page.locale);

  return (
    <AuthProvider>
      <JsonLd
        data={foodPageStructuredData({
          locale: page.locale,
          url: `${SITE_URL}${foodPagePath(page.locale, page.slug)}`,
          title: page.title,
          description: page.description(span),
          hubName: chrome.footerLink,
          hubPath: `/${page.locale}${FOOD_PAGE_PREFIX}`,
          name: page.name,
          capturedAt: page.capture.capturedAt,
        })}
      />
      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {page.title}
          </h1>
          <p className="mt-3 font-sans-display text-kallo-text-muted text-sm">
            {chrome.loggedOn(loggedOn)}
          </p>
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <DocsParagraph>{page.lead(span)}</DocsParagraph>
          <MealSummaryTable
            heads={chrome.tableHeads}
            meals={page.meals}
            variants={page.capture.variants}
          />
          <LinkedSentence
            {...chrome.rangeNote}
            href={MEAL_DATA_PATH}
            link={chrome.rangeNote.link(facts.dishes, facts.ratio)}
          />

          {page.meals.map((meal) => {
            const variant = page.capture.variants.find(
              (v) => v.key === meal.key
            );
            return variant ? (
              <MealExample
                key={meal.key}
                label={meal.label}
                variant={variant}
              />
            ) : null;
          })}

          <DocsH2>{chrome.movesHeading}</DocsH2>
          <DocsParagraph>{page.breakdownLead}</DocsParagraph>
          <IngredientBars ingredients={breakdownOf(page)} />

          <DocsH2>{chrome.sourcesHeading}</DocsH2>
          <DocsParagraph>
            {chrome.sourcesBody(loggedOn, sourcesOf(page))}
          </DocsParagraph>
          <LinkedSentence
            {...chrome.dailyNote}
            href={toolPath('tdee-calculator')}
          />

          <DocsH2>{chrome.moreHeading}</DocsH2>
          <FoodLinkList pages={relatedPages(page)} />

          <DocsH2>{chrome.similarHeading}</DocsH2>
          <FoodLinkList pages={similarCaloriePages(page)} />
          <LinkedSentence
            {...chrome.browse}
            href={FOOD_PAGE_PREFIX}
            link={chrome.browse.link(FOOD_SLUGS[page.locale].length)}
          />

          <div className="mt-16 border-kallo-text border-t pt-10 text-center">
            <DocsParagraph>{page.tryLine}</DocsParagraph>
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
