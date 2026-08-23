import { describe, expect, it } from 'vitest';
import { landingStructuredData } from '@/lib/seo/structured-data';

const graph = landingStructuredData({
  locale: 'en',
  name: 'Kallo',
  description: 'Describe what you ate.',
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
