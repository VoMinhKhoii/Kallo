import { describe, expect, it } from 'vitest';
import {
  docsBreadcrumbStructuredData,
  landingStructuredData,
} from '@/lib/seo/structured-data';

const graph = landingStructuredData({
  locale: 'vi',
  description: 'Describe what you ate.',
  organizationDescription: 'Kallo là ứng dụng theo dõi calo.',
})['@graph'] as Array<Record<string, unknown>>;

const organization = graph.find((node) => node['@type'] === 'Organization');

describe('the Organization node', () => {
  it('exists and is cross-linked as the publisher', () => {
    expect(organization).toBeDefined();
    for (const type of ['WebSite', 'SoftwareApplication']) {
      const node = graph.find((entry) => entry['@type'] === type);
      expect(node?.publisher, type).toEqual({
        '@id': 'https://kallo.fit/#organization',
      });
    }
  });

  it('carries a contactPoint an AI can answer a contact question from', () => {
    const points = organization?.contactPoint as Array<Record<string, string>>;
    expect(points).toBeInstanceOf(Array);
    expect(points.length).toBeGreaterThan(0);

    for (const point of points) {
      expect(point['@type']).toBe('ContactPoint');
      expect(point.contactType).toBeTruthy();
      expect(point.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    }

    const support = points.find((p) => p.contactType === 'customer support');
    expect(support?.email).toBe('support@kallo.fit');
    expect(support?.availableLanguage).toEqual(['en', 'vi']);
  });

  it('points the support contact at the contact page in the same locale', () => {
    // The graph above is built for `vi`; an English URL there would send a
    // Vietnamese reader (or an agent quoting the markup) to the wrong page.
    const points = organization?.contactPoint as Array<Record<string, string>>;
    const support = points.find((p) => p.contactType === 'customer support');
    expect(support?.url).toBe('https://kallo.fit/vi/docs/company/contact');
  });

  it('says in one sentence what the company is, in the page locale', () => {
    expect(organization?.description).toBe('Kallo là ứng dụng theo dõi calo.');
  });

  it('publishes only company-domain contact addresses', () => {
    const points = organization?.contactPoint as Array<Record<string, string>>;
    for (const point of points) {
      expect(point.email, point.contactType).toMatch(/@kallo\.fit$/);
    }
  });

  it('links the company page and names the founder', () => {
    expect(organization?.sameAs).toContain(
      'https://www.linkedin.com/company/kallo-fit/'
    );
    expect(organization?.founder).toMatchObject({
      '@type': 'Person',
      name: 'Võ Minh Khôi',
      email: 'founder@kallo.fit',
    });
  });

  it('carries a PostalAddress with a country', () => {
    const address = organization?.address as Record<string, string>;
    expect(address['@type']).toBe('PostalAddress');
    expect(address.addressCountry).toBe('VN');
    expect(address.addressLocality).toBeTruthy();
  });

  it('does not publish a street address', () => {
    // Deliberate: the full address is in the privacy policy because data
    // protection law requires a controller to give one. Repeating it in markup
    // that gets scraped into every AI index is a different exposure, and
    // PostalAddress is valid without it.
    const address = organization?.address as Record<string, string>;
    expect(address).not.toHaveProperty('streetAddress');
    expect(address).not.toHaveProperty('postalCode');
  });

  it('still invents no ratings', () => {
    // aggregateRating/review on a product with no rating source is the exact
    // pattern Google issues manual actions for.
    const json = JSON.stringify(graph);
    expect(json).not.toContain('aggregateRating');
    expect(json).not.toContain('"review"');
  });
});

describe('the WebSite node', () => {
  const website = graph.find((node) => node['@type'] === 'WebSite');

  it('names the brand at the domain root on every locale', () => {
    // Google takes the site name from WebSite markup at the domain root only;
    // a locale URL or the localized page title would not count as one.
    expect(website?.name).toBe('Kallo');
    expect(website?.url).toBe('https://kallo.fit/');
    expect(website?.alternateName).toBe('kallo.fit');
  });
});

describe('docsBreadcrumbStructuredData', () => {
  const crumbs = (data: ReturnType<typeof docsBreadcrumbStructuredData>) =>
    data.itemListElement as Array<Record<string, unknown>>;

  it('is a BreadcrumbList that runs Kallo, Docs, then the page', () => {
    const data = docsBreadcrumbStructuredData({
      locale: 'en',
      slug: 'quickstart',
      docsLabel: 'Docs',
      title: 'Log your first meal',
    });

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('BreadcrumbList');
    expect(crumbs(data)).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Kallo',
        item: 'https://kallo.fit/en',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Docs',
        item: 'https://kallo.fit/en/docs/overview',
      },
      { '@type': 'ListItem', position: 3, name: 'Log your first meal' },
    ]);
  });

  it('localizes the labels and every URL', () => {
    const data = docsBreadcrumbStructuredData({
      locale: 'vi',
      slug: 'logging/barcode',
      docsLabel: 'Tài liệu',
      title: 'Quét mã vạch',
    });
    const [home, docs, page] = crumbs(data);

    expect(home?.item).toBe('https://kallo.fit/vi');
    expect(docs).toMatchObject({
      name: 'Tài liệu',
      item: 'https://kallo.fit/vi/docs/overview',
    });
    // The last crumb is the page being read, so it has no URL of its own.
    expect(page).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'Quét mã vạch',
    });
  });

  it('ends on Docs for the overview page rather than listing it twice', () => {
    const data = docsBreadcrumbStructuredData({
      locale: 'en',
      slug: 'overview',
      docsLabel: 'Docs',
      title: 'Overview',
    });

    expect(crumbs(data)).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Kallo',
        item: 'https://kallo.fit/en',
      },
      { '@type': 'ListItem', position: 2, name: 'Docs' },
    ]);
  });
});
