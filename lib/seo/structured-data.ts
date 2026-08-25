import { SITE_URL } from '@/lib/seo/site';

/** Where a reader — or an agent answering "how do I contact them" — should write. */
export const SUPPORT_EMAIL = 'support@kallo.fit';
/** The address SECURITY.md publishes for private vulnerability reports. */
export const SECURITY_EMAIL = 'minhkhoitdn@gmail.com';

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
        email: SUPPORT_EMAIL,
        // Locality and country, not the street address. The full address is
        // published in the privacy policy because data protection law requires
        // a controller to give one; repeating it in markup that gets scraped
        // into every AI index is a different exposure, and `PostalAddress`
        // needs neither `streetAddress` nor `postalCode` to be valid.
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Ho Chi Minh City',
          addressCountry: 'VN',
        },
        // Two points, because the two inboxes have genuinely different
        // handling: support is read by a person during the day, security is the
        // address SECURITY.md commits to a 48-hour acknowledgement on.
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: SUPPORT_EMAIL,
            url: `${SITE_URL}/en/docs/company/contact`,
            availableLanguage: ['en', 'vi'],
          },
          {
            '@type': 'ContactPoint',
            contactType: 'security',
            email: SECURITY_EMAIL,
            availableLanguage: ['en', 'vi'],
          },
        ],
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
