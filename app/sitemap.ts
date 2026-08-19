import type { MetadataRoute } from 'next';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/navigation';
import { loadFrontmatter } from '@/lib/domain/docs/loader';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';
import { SITE_URL } from '@/lib/seo/site';

// Only the publicly crawlable, unauthenticated surfaces belong here. Everything
// behind auth (dashboard, settings, groups, …) is disallowed in robots.ts.
//
// The docs paths are derived from the docs nav rather than listed by hand, so
// adding a page cannot leave the sitemap behind. /privacy and /terms are gone:
// they now live under /docs/legal and the old paths 308 there (next.config.ts).

/**
 * Every locale's URL for one path, keyed by language code.
 *
 * Emitted as `xhtml:link` alternates on each entry. Google requires the set to
 * be reciprocal and self-inclusive — every version, including the entry's own
 * URL — or it discards the annotation, which is why `en` appears on the `en`
 * row too. `x-default` is the default locale: what `/` resolves to for a
 * visitor whose language matches neither.
 */
function languagesFor(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}/${locale}${path}`;
  }
  languages['x-default'] = `${SITE_URL}/${routing.defaultLocale}${path}`;

  return languages;
}

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
      alternates: { languages: languagesFor('') },
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
        alternates: { languages: languagesFor(path) },
      });
    }
  }

  return entries;
}
