import type { MetadataRoute } from 'next';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { loadFrontmatter } from '@/lib/domain/docs/loader';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';
import { alternateLanguages } from '@/lib/seo/alternates';
import {
  captureDateRange,
  FOOD_PAGE_LAYOUT_REVISED,
  pagesOf,
} from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_PAGE_PREFIX,
  foodHubPath,
  foodPagePath,
} from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { SITE_URL } from '@/lib/seo/site';
import {
  TOOL_PAGES_REVISED,
  TOOL_SLUGS,
  TOOLS_PREFIX,
  toolPath,
} from '@/lib/seo/tools/slugs';

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

    // The landing page only links here now: /pricing is
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

    // The calculators exist in every locale under the same slugs. The hub has
    // no revision date to read, so like the landing page it carries no
    // `lastModified`; a tool page is dated by `TOOL_PAGES_REVISED`, bumped by
    // hand when its copy or links change.
    entries.push({
      url: `${SITE_URL}/${locale}${TOOLS_PREFIX}`,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: alternateLanguages(TOOLS_PREFIX) },
    });
    for (const path of TOOL_SLUGS.map(toolPath)) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: new Date(`${TOOL_PAGES_REVISED}T00:00:00Z`),
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: { languages: alternateLanguages(path) },
      });
    }
  }

  // Each locale's food pages are its own dishes, so a page carries no
  // language alternates; only the hubs pair. A page's date is the day its
  // meals were captured or the shared layout last changed, whichever is
  // later; a hub's is its newest capture.
  for (const locale of FOOD_PAGE_LOCALES) {
    const pages = pagesOf(locale);
    entries.push({
      url: `${SITE_URL}${foodHubPath(locale)}`,
      lastModified: new Date(captureDateRange(locale).last),
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: alternateLanguages(FOOD_PAGE_PREFIX) },
    });
    // The food pages read together, in each locale from its own dishes; the
    // same concept, so the two pair as alternates. Dated like the hub.
    entries.push({
      url: `${SITE_URL}/${locale}${MEAL_DATA_PATH}`,
      lastModified: new Date(captureDateRange(locale).last),
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: { languages: alternateLanguages(MEAL_DATA_PATH) },
    });
    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}${foodPagePath(page.locale, page.slug)}`,
        lastModified: new Date(
          Math.max(
            Date.parse(page.capture.capturedAt),
            Date.parse(`${FOOD_PAGE_LAYOUT_REVISED}T00:00:00Z`)
          )
        ),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return entries;
}
