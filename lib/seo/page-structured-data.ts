import { SITE_URL } from '@/lib/seo/site';

/**
 * JSON-LD for the public food, calculator and data pages. The landing page's
 * full Organization node lives in `structured-data.ts`; here each page points
 * at it by `@id`, so a crawler reads one publisher across the whole site.
 *
 * Only what the page itself shows goes in. No `Recipe` or
 * `NutritionInformation`: these are logged meals, not recipes, and marking
 * them up as one is the kind of mismatch Google issues manual actions for.
 */
const PUBLISHER = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Kallo',
  url: SITE_URL,
};

interface Crumb {
  name: string;
  /** Left off the last crumb: it is the page itself. */
  path?: string;
}

/** Kallo, then the trail, as Google's breadcrumb result reads it. */
function breadcrumb(locale: string, trail: Crumb[]) {
  const crumbs: Crumb[] = [{ name: 'Kallo', path: `/${locale}` }, ...trail];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      ...(path ? { item: `${SITE_URL}${path}` } : {}),
    })),
  };
}

/** A food page: a dated article, in the trail Kallo > hub > dish. */
export function foodPageStructuredData({
  locale,
  url,
  title,
  description,
  hubName,
  hubPath,
  name,
  capturedAt,
}: {
  locale: string;
  url: string;
  title: string;
  description: string;
  hubName: string;
  /** With the locale: `/en/calories`. */
  hubPath: string;
  name: string;
  capturedAt: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb(locale, [{ name: hubName, path: hubPath }, { name }]),
      {
        '@type': 'Article',
        headline: title,
        description,
        url,
        mainEntityOfPage: url,
        inLanguage: locale,
        datePublished: capturedAt,
        dateModified: capturedAt,
        author: PUBLISHER,
        publisher: PUBLISHER,
      },
    ],
  };
}

/** A hub: the trail, and the pages it lists in order. */
export function hubStructuredData({
  locale,
  name,
  items,
}: {
  locale: string;
  name: string;
  items: { name: string; url: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb(locale, [{ name }]),
      {
        '@type': 'ItemList',
        name,
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          ...item,
        })),
      },
    ],
  };
}

/** A calculator: free, in the browser, no account. */
export function toolStructuredData({
  locale,
  url,
  name,
  description,
  hubName,
  hubPath,
}: {
  locale: string;
  url: string;
  name: string;
  description: string;
  hubName: string;
  /** With the locale: `/en/tools`. */
  hubPath: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb(locale, [{ name: hubName, path: hubPath }, { name }]),
      {
        '@type': 'WebApplication',
        name,
        description,
        url,
        inLanguage: locale,
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: PUBLISHER,
      },
    ],
  };
}

/** The data page, for Google Dataset Search. No licence is claimed: none is granted. */
export function mealDataStructuredData({
  locale,
  url,
  name,
  description,
  first,
  last,
}: {
  locale: string;
  url: string;
  name: string;
  description: string;
  /** The capture window, as ISO strings. */
  first: string;
  last: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb(locale, [{ name }]),
      {
        '@type': 'Dataset',
        name,
        description,
        url,
        inLanguage: locale,
        isAccessibleForFree: true,
        temporalCoverage: `${first.slice(0, 10)}/${last.slice(0, 10)}`,
        variableMeasured: ['Energy (kcal)', 'Protein', 'Carbohydrate', 'Fat'],
        creator: PUBLISHER,
      },
    ],
  };
}
