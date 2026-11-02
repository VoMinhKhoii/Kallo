import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsH2, DocsLink, DocsParagraph } from '@/components/docs/mdx/prose';
import { FoodLinkList } from '@/components/seo/food-page/food-link-list';
import { IngredientBars } from '@/components/seo/food-page/ingredient-bars';
import { MealExample } from '@/components/seo/food-page/meal-example';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import {
  breakdownOf,
  FOOD_PAGES,
  type FoodPage as FoodPageData,
  kcalSpan,
  relatedPages,
  sourcesOf,
} from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  foodPagePath,
  isFoodLocale,
  isFoodSlug,
} from '@/lib/seo/food-pages/slugs';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

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

export function generateStaticParams() {
  return FOOD_PAGE_LOCALES.flatMap((locale) =>
    FOOD_SLUGS[locale].map((food) => ({ locale, food }))
  );
}

/** The page a URL names, or null when its locale has no such page. */
function pageAt(locale: string, food: string): FoodPageData | null {
  if (!isFoodLocale(locale) || !isFoodSlug(locale, food)) return null;
  return FOOD_PAGES[food];
}

export async function generateMetadata({
  params,
}: FoodPageProps): Promise<Metadata> {
  const { locale, food } = await params;
  const page = pageAt(locale, food);
  if (!page) return {};
  const url = `${SITE_URL}${foodPagePath(page.locale, page.slug)}`;
  const description = page.description(kcalSpan(page.capture, page.locale));
  return {
    title: page.metaTitle,
    description,
    alternates: { canonical: url },
    // Spread, not a bare object: declaring `openGraph` replaces the layout's
    // wholesale, and setting only the url would drop the preview image.
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: page.metaTitle,
      description,
    },
  };
}

export default function FoodPage({ params }: FoodPageProps) {
  return (
    <Suspense fallback={null}>
      <FoodContent params={params} />
    </Suspense>
  );
}

async function FoodContent({ params }: FoodPageProps) {
  const { locale, food } = await params;
  const page = pageAt(locale, food);
  if (!page) notFound();
  const chrome = FOOD_PAGE_CHROME[page.locale];
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const loggedOn = chrome.formatDate(new Date(page.capture.capturedAt));

  return (
    <AuthProvider>
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
          <DocsParagraph>
            {page.lead(kcalSpan(page.capture, page.locale))}
          </DocsParagraph>

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

          <DocsH2>{chrome.moreHeading}</DocsH2>
          <FoodLinkList pages={relatedPages(page)} />
          <DocsParagraph>
            {chrome.browse.before}
            <DocsLink href={FOOD_PAGE_PREFIX}>
              {chrome.browse.link(FOOD_SLUGS[page.locale].length)}
            </DocsLink>
            {chrome.browse.after}
          </DocsParagraph>

          <div className="mt-16 border-kallo-text border-t pt-10 text-center">
            <DocsParagraph>{page.tryLine}</DocsParagraph>
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
