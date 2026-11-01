import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DocsH2, DocsParagraph } from '@/components/docs/mdx/prose';
import { FoodLinkList } from '@/components/seo/food-page/food-link-list';
import { pagesByGroup } from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALE,
  FOOD_SLUGS,
  foodHubPath,
} from '@/lib/seo/food-pages/slugs';
import { FOOD_GROUPS } from '@/lib/seo/food-pages/types';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The food pages' index: every page, by kind of meal, with the span its
 * meals cover. It is what links the pages into the site, so a crawler that
 * reaches the footer reaches all of them.
 *
 * English only, like the pages: the proxy answers any other locale with the
 * real 404 (`unknownFoodPageTarget`).
 */
interface CaloriesHubProps {
  params: Promise<{ locale: string }>;
}

const TITLE = `Calories in ${FOOD_SLUGS.length} Everyday Meals, Logged for Real`;
const DESCRIPTION = `How many calories are in a burrito, a poke bowl or pad thai? ${FOOD_SLUGS.length} everyday meals, each logged in Kallo four ways, with the ingredients that move the number.`;

export function generateStaticParams() {
  return [{ locale: FOOD_PAGE_LOCALE }];
}

export async function generateMetadata({
  params,
}: CaloriesHubProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== FOOD_PAGE_LOCALE) return {};
  const url = `${SITE_URL}${foodHubPath()}`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default function CaloriesHub({ params }: CaloriesHubProps) {
  return (
    <Suspense fallback={null}>
      <HubContent params={params} />
    </Suspense>
  );
}

async function HubContent({ params }: CaloriesHubProps) {
  const { locale } = await params;
  if (locale !== FOOD_PAGE_LOCALE) notFound();

  return (
    <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
      <div className="mt-3 text-center">
        <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
          Calories in everyday meals
        </h1>
      </div>

      <hr className="mt-8 border-kallo-text border-t" />

      <div className="mt-10">
        <DocsParagraph>
          A meal is not one number. The same burrito is 300 kcal or 1,000
          depending on the tortilla, the rice and what goes on top. Each page
          below logs one meal in Kallo four ways, from a restaurant plate to a
          weighed homemade one, and shows which ingredients move the number.
        </DocsParagraph>

        {pagesByGroup().map(({ group, pages }) => (
          <section key={group}>
            <DocsH2>{FOOD_GROUPS[group]}</DocsH2>
            <FoodLinkList pages={pages} />
          </section>
        ))}
      </div>
    </article>
  );
}
