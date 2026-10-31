import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsH2, DocsParagraph } from '@/components/docs/mdx/prose';
import { IngredientBars } from '@/components/seo/food-page/ingredient-bars';
import { MealExample } from '@/components/seo/food-page/meal-example';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { FOOD_PAGE_MEALS } from '@/lib/seo/food-pages/meals';
import {
  breakdownOf,
  FOOD_PAGES,
  kcalSpan,
  sourcesOf,
} from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALE,
  FOOD_SLUGS,
  foodPagePath,
  isFoodSlug,
} from '@/lib/seo/food-pages/slugs';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * A public food page: one question ("how many calories in a chicken
 * burrito?") answered with real meals logged in Kallo. The copy and numbers
 * live in `lib/seo/food-pages/`; this route lays them out in the docs shell.
 *
 * English only. Another locale or an unknown slug gets its real 404 from the
 * proxy (`unknownFoodPageTarget`); `notFound()` here is the backstop.
 */
interface FoodPageProps {
  params: Promise<{ locale: string; food: string }>;
}

export function generateStaticParams() {
  return FOOD_SLUGS.map((food) => ({ locale: FOOD_PAGE_LOCALE, food }));
}

export async function generateMetadata({
  params,
}: FoodPageProps): Promise<Metadata> {
  const { locale, food } = await params;
  if (locale !== FOOD_PAGE_LOCALE || !isFoodSlug(food)) return {};
  const page = FOOD_PAGES[food];
  const url = `${SITE_URL}${foodPagePath(food)}`;
  const description = page.description(kcalSpan(page.capture));
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
  if (locale !== FOOD_PAGE_LOCALE || !isFoodSlug(food)) notFound();
  const page = FOOD_PAGES[food];
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const loggedOn = new Date(page.capture.capturedAt).toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  );

  return (
    <AuthProvider>
      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {page.title}
          </h1>
          <p className="mt-3 font-sans-display text-kallo-text-muted text-sm">
            Logged in Kallo on {loggedOn}
          </p>
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <DocsParagraph>{page.lead(kcalSpan(page.capture))}</DocsParagraph>

          {FOOD_PAGE_MEALS[food].map((meal) => {
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

          <DocsH2>What moves the number</DocsH2>
          <DocsParagraph>{page.breakdownLead}</DocsParagraph>
          <IngredientBars ingredients={breakdownOf(page)} />

          <DocsH2>Where these numbers come from</DocsH2>
          <DocsParagraph>
            Each meal above was typed into Kallo once, on {loggedOn}. Kallo
            split it into ingredients, estimated the grams, and took calories
            and macros from {sourcesOf(page.capture)}.
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
