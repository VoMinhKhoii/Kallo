import type { MetadataRoute } from 'next';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { loadFrontmatter } from '@/lib/domain/docs/loader';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGES } from '@/lib/seo/food-pages/pages';
import { FOOD_PAGE_LOCALE, FOOD_SLUGS } from '@/lib/seo/food-pages/slugs';
import { SITE_URL } from '@/lib/seo/site';

// Only the publicly crawlable, unauthenticated surfaces belong here. Everything
// behind auth (dashboard, settings, groups, …) is disallowed in robots.ts.
//
// The docs paths are derived from the docs nav rather than listed by hand, so
// adding a page cannot leave the sitemap behind. /privacy and /terms are gone:
// they now live under /docs/legal and the old paths 308 there (next.config.ts).

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    // The landing page carries no `lastModified` on purpose. Its content lives
    // in components and messages with no revision date to read, and the
    // previous `new Date()` restamped every URL on every build — a sitemap
    // that always claims "changed just now" is one Google learns to ignore
    // wholesale, taking the accurate docs dates down with it. Google's own
    // guidance is to omit the field rather than guess it.
    entries.push({
      url: `${SITE_URL}/${locale}`,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: alternateLanguages('') },
    });

    // The plans also render as a band on the landing page, but /pricing is
    // their own crawlable URL — it needs its own entry or it is only ever
    // reachable as an in-page anchor.
    entries.push({
      url: `${SITE_URL}/${locale}/pricing`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: alternateLanguages('/pricing') },
    });

    for (const slug of DOCS_SLUGS) {
      // Hand-maintained `YYYY-MM-DD` in each MDX file's frontmatter — the same
      // value the page renders as its revision stamp, so the sitemap can never
      // disagree with what a reader sees. Required on every doc, but parsed
      // defensively: a malformed date must not fail the build's sitemap.
      const frontmatter = await loadFrontmatter(locale as Locale, slug);
      const parsed = frontmatter
        ? new Date(`${frontmatter.lastUpdated}T00:00:00Z`)
        : null;
      const path = `/docs/${slug}`;

      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        ...(parsed && !Number.isNaN(parsed.getTime())
          ? { lastModified: parsed }
          : {}),
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: { languages: alternateLanguages(path) },
      });
    }
  }

  // The food pages are English only, so they carry no language alternates.
  // Their date is the day their meals were captured.
  for (const slug of FOOD_SLUGS) {
    entries.push({
      url: `${SITE_URL}/${FOOD_PAGE_LOCALE}/calories/${slug}`,
      lastModified: new Date(FOOD_PAGES[slug].capture.capturedAt),
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  return entries;
}
