import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DocsH2, DocsParagraph } from '@/components/docs/mdx/prose';
import { FoodLinkList } from '@/components/seo/food-page/food-link-list';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { groupName, pagesByGroup } from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  foodHubPath,
  isFoodLocale,
} from '@/lib/seo/food-pages/slugs';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * A locale's food pages index: every page, by kind of meal, with the span its
 * meals cover. It is what links the pages into the site, so a crawler that
 * reaches the footer reaches all of them.
 *
 * English and Vietnamese list different dishes, so only the hubs pair as
 * language alternates; the pages under them do not. A locale without food
 * pages gets the real 404 from the proxy (`unknownFoodPageTarget`).
 */
interface CaloriesHubProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return FOOD_PAGE_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: CaloriesHubProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isFoodLocale(locale)) return {};
  const { hub } = FOOD_PAGE_CHROME[locale];
  const count = FOOD_SLUGS[locale].length;
  const url = `${SITE_URL}${foodHubPath(locale)}`;
  return {
    title: hub.title(count),
    description: hub.description(count),
    alternates: {
      canonical: url,
      languages: alternateLanguages(FOOD_PAGE_PREFIX),
    },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: hub.title(count),
      description: hub.description(count),
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
  if (!isFoodLocale(locale)) notFound();
  const { hub } = FOOD_PAGE_CHROME[locale];

  return (
    <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
      <div className="mt-3 text-center">
        <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
          {hub.heading}
        </h1>
      </div>

      <hr className="mt-8 border-kallo-text border-t" />

      <div className="mt-10">
        <DocsParagraph>{hub.intro}</DocsParagraph>

        {pagesByGroup(locale).map(({ group, pages }) => (
          <section key={group}>
            <DocsH2>{groupName(locale, group)}</DocsH2>
            <FoodLinkList pages={pages} />
          </section>
        ))}
      </div>
    </article>
  );
}
