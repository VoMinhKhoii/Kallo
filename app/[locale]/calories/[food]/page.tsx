import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsH2, DocsParagraph } from '@/components/docs/mdx/prose';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import type { DishRowsMeal } from '@/components/logging/feed/persisted/meal-details';
import { PersistedMealBody } from '@/components/logging/feed/persisted/persisted-meal-body';
import { UserMessageBubble } from '@/components/logging/feed/turn/user-message-bubble';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import {
  FOOD_PAGES,
  FOOD_SLUGS,
  type FoodPageVariant,
  isFoodSlug,
} from '@/lib/seo/food-pages/pages';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * A public food page: one question ("how many calories in a chicken
 * burrito?") answered with real meals logged in Kallo. The copy and numbers
 * live in `lib/seo/food-pages/`; this route lays them out in the docs shell
 * and shows each meal with the app's own pieces — the user's message bubble
 * and the saved meal card's body, opened.
 *
 * English only: any other locale is a 404.
 */
interface FoodPageProps {
  params: Promise<{ locale: string; food: string }>;
}

export function generateStaticParams() {
  return FOOD_SLUGS.map((food) => ({ locale: 'en', food }));
}

export async function generateMetadata({
  params,
}: FoodPageProps): Promise<Metadata> {
  const { locale, food } = await params;
  if (locale !== 'en' || !isFoodSlug(food)) return {};
  const page = FOOD_PAGES[food];
  const url = `${SITE_URL}/en/calories/${food}`;
  return {
    title: page.metaTitle,
    description: page.description,
    alternates: { canonical: url },
    // Spread, not a bare object: declaring `openGraph` replaces the layout's
    // wholesale, and setting only the url would drop the preview image.
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: page.metaTitle,
      description: page.description,
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

/** The meal card's dish rows, from a captured meal. */
function dishRowsOf(variant: FoodPageVariant): DishRowsMeal {
  return {
    mealItemGroups: variant.dishes.map((dish, order) => ({
      order,
      name: dish.name,
      nutrition: {
        caloriesKcal: dish.calories,
        proteinG: dish.protein,
        carbohydrateG: dish.carbs,
        fatG: dish.fat,
      },
    })),
  };
}

function totalsOf(variant: FoodPageVariant) {
  const sum = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    variant.dishes.reduce((total, dish) => total + dish[key], 0);
  return {
    calories: formatCaloriesOrNA(sum('calories')),
    protein: formatMacroOrNA(sum('protein')),
    carbs: formatMacroOrNA(sum('carbs')),
    fat: formatMacroOrNA(sum('fat')),
  };
}

async function FoodContent({ params }: FoodPageProps) {
  const { locale, food } = await params;
  if (locale !== 'en' || !isFoodSlug(food)) notFound();
  const page = FOOD_PAGES[food];
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const { variants, capturedAt } = page.capture;
  const breakdown = [
    ...(variants.find((v) => v.key === page.breakdownOf)?.ingredients ?? []),
  ].sort((a, b) => b.kcal - a.kcal);
  const maxKcal = breakdown[0]?.kcal ?? 1;
  // Named from the rows the meals actually used, never a fixed list.
  const sources = new Intl.ListFormat('en', { type: 'conjunction' }).format([
    ...new Set(variants.flatMap((v) => v.ingredients.map((i) => i.source))),
  ]);
  const loggedOn = new Date(capturedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

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
          <DocsParagraph>{page.lead}</DocsParagraph>

          {variants.map((variant) => (
            <section key={variant.key} className="mt-12">
              <h3 className="mb-4 font-semibold text-h4 text-kallo-text">
                {page.labels[variant.key]}
              </h3>
              <div className="mb-3">
                <UserMessageBubble text={variant.text} />
              </div>
              {/* The saved meal card's shell, as in the app's feed. */}
              <div className="rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-sm sm:p-5">
                <p className="font-sans-display text-kallo-text text-sm leading-relaxed">
                  {variant.text}
                </p>
                <PersistedMealBody
                  meal={dishRowsOf(variant)}
                  isCollapsed={false}
                  totals={totalsOf(variant)}
                />
              </div>
            </section>
          ))}

          <DocsH2>What moves the number</DocsH2>
          <DocsParagraph>{page.breakdownLead}</DocsParagraph>
          <div className="mt-6 space-y-3">
            {breakdown.map((ingredient) => (
              <div
                key={ingredient.name}
                className="font-sans-display text-[13px]"
              >
                <div className="flex justify-between">
                  <span className="font-medium text-kallo-text">
                    {ingredient.name}{' '}
                    <span className="font-normal text-kallo-text-muted">
                      · {ingredient.grams} g
                    </span>
                  </span>
                  <span className="font-bold text-kallo-text tabular-nums">
                    {ingredient.kcal} kcal
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-kallo-track">
                  <div
                    className="h-full rounded-full bg-kallo-text"
                    style={{ width: `${(ingredient.kcal / maxKcal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <DocsH2>Where these numbers come from</DocsH2>
          <DocsParagraph>
            Each meal above was typed into Kallo once, on {loggedOn}. Kallo
            split it into ingredients, estimated the grams, and took calories
            and macros from {sources}.
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
