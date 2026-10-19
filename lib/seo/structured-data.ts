import { SITE_URL } from '@/lib/seo/site';

/** Where a reader — or an agent answering "how do I contact them" — should write. */
export const SUPPORT_EMAIL = 'support@kallo.fit';
/** The address SECURITY.md publishes for private vulnerability reports. */
export const SECURITY_EMAIL = 'security@kallo.fit';
/** Partnerships, press and commercial licensing — reaches the founder directly. */
export const FOUNDER_EMAIL = 'founder@kallo.fit';
/** The Kallo company page, linked from the site footer and `sameAs`. */
export const LINKEDIN_URL = 'https://www.linkedin.com/company/kallo-fit/';

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
  description,
  organizationDescription,
}: {
  locale: string;
  /** Localized one-liner — `metadata.root.description`. */
  description: string;
  /** What the company is, in one sentence — `metadata.organization.description`. */
  organizationDescription: string;
}) {
  const url = `${SITE_URL}/${locale}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Kallo',
        description: organizationDescription,
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
        email: SUPPORT_EMAIL,
        founder: {
          '@type': 'Person',
          name: 'Võ Minh Khôi',
          jobTitle: 'Founder',
          email: FOUNDER_EMAIL,
          sameAs: ['https://www.linkedin.com/in/khoi-vo-1648112a0/'],
        },
        sameAs: [LINKEDIN_URL, 'https://github.com/VoMinhKhoii/Kallo'],
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
            url: `${SITE_URL}/${locale}/docs/company/contact`,
            availableLanguage: ['en', 'vi'],
          },
          {
            '@type': 'ContactPoint',
            contactType: 'security',
            email: SECURITY_EMAIL,
            availableLanguage: ['en', 'vi'],
          },
          {
            '@type': 'ContactPoint',
            contactType: 'partnerships',
            email: FOUNDER_EMAIL,
            availableLanguage: ['en', 'vi'],
          },
        ],
      },
      // Google reads this node for the site name it prints above a result, and
      // only accepts it for the domain root: `url` is the bare origin even on
      // /en and /vi (`/` redirects to them), and `name` is the brand alone. The
      // localized page title (`metadata.root.title`) is a search pitch, not a
      // name, and is what Google would otherwise show as the site name.
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'Kallo',
        alternateName: 'kallo.fit',
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

/**
 * A docs page's breadcrumb trail: Kallo, Docs, then the page itself.
 *
 * The visible breadcrumb above the title reads "Docs · <section>", but a
 * section has no page of its own to link, and Google needs a URL on every crumb
 * except the last, so the trail leaves the section out and ends on the page
 * (whose title is the `h1` right under it). The overview page IS the Docs
 * crumb, so its trail stops there rather than listing the same page twice.
 */
export function docsBreadcrumbStructuredData({
  locale,
  slug,
  docsLabel,
  title,
}: {
  locale: string;
  slug: string;
  /** The visible breadcrumb's first crumb — `docs.breadcrumb.home`. */
  docsLabel: string;
  /** The page's own title (its `h1`). */
  title: string;
}) {
  const isOverview = slug === 'overview';
  const trail = [
    { name: 'Kallo', item: `${SITE_URL}/${locale}` },
    isOverview
      ? { name: docsLabel }
      : { name: docsLabel, item: `${SITE_URL}/${locale}/docs/overview` },
    ...(isOverview ? [] : [{ name: title }]),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...crumb,
    })),
  };
}
