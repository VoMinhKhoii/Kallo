import { SITE_URL } from '@/lib/site';

/**
 * The landing page's JSON-LD graph.
 *
 * Three linked nodes rather than three loose objects: the `@id` cross-links are
 * what let a crawler understand that the publisher of the site and the maker of
 * the app are the same entity, instead of reading them as unrelated things that
 * happen to share a name.
 *
 * Deliberately absent: `aggregateRating` and `review`. Both are review-snippet
 * fields, and inventing numbers for them is the exact pattern Google issues
 * manual actions for. They go in when there is a real rating source to read.
 */
export function landingStructuredData({
  locale,
  name,
  description,
}: {
  locale: string;
  /** Localized product name — `metadata.root.title`. */
  name: string;
  /** Localized one-liner — `metadata.root.description`. */
  description: string;
}) {
  const url = `${SITE_URL}/${locale}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Kallo',
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url,
        name,
        description,
        inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: 'Kallo',
        description,
        url,
        applicationCategory: 'HealthApplication',
        // Web only, on purpose: the Flutter build is not publicly listed yet,
        // so claiming iOS/Android here would describe a store page that a
        // crawler cannot find. Add them when the listings go live.
        operatingSystem: 'Web',
        publisher: { '@id': `${SITE_URL}/#organization` },
        // The free tier is real and needs no card, so a zero-price Offer is
        // accurate. The paid tiers are not listed: they are a subscription with
        // monthly/yearly/lifetime variants, and flattening them to one number
        // would misdescribe the price on the page.
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    ],
  };
}
