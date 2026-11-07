import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsH2, DocsLink, DocsParagraph } from '@/components/docs/mdx/prose';
import { FoodLinkList } from '@/components/seo/food-page/food-link-list';
import { JsonLd } from '@/components/seo/json-ld';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { groupName, pagesByGroup, pagesOf } from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  foodHubPath,
  foodPagePath,
  isFoodLocale,
} from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { hubStructuredData } from '@/lib/seo/page-structured-data';
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

export default async function CaloriesHub({ params }: CaloriesHubProps) {
  const { locale } = await params;
  if (!isFoodLocale(locale)) notFound();
  const { hub } = FOOD_PAGE_CHROME[locale];

  return (
    <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
      <JsonLd
        data={hubStructuredData({
          locale,
          name: hub.heading,
          items: pagesOf(locale).map((page) => ({
            name: page.name,
            url: `${SITE_URL}${foodPagePath(page.locale, page.slug)}`,
          })),
        })}
      />
      <div className="mt-3 text-center">
        <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
          {hub.heading}
        </h1>
      </div>

      <hr className="mt-8 border-kallo-text border-t" />

      <div className="mt-10">
        <DocsParagraph>{hub.intro}</DocsParagraph>
        <DocsParagraph>
          <DocsLink href={MEAL_DATA_PATH}>
            {FOOD_PAGE_CHROME[locale].dataLink}
          </DocsLink>
        </DocsParagraph>

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
