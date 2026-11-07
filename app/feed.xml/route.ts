import {
  captureDateRange,
  kcalSpan,
  pagesOf,
} from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_LOCALES,
  foodHubPath,
  foodPagePath,
} from '@/lib/seo/food-pages/slugs';
import { SITE_URL } from '@/lib/seo/site';

/**
 * `/feed.xml`: the food pages as an Atom feed. Search engines take a feed as a
 * second way to learn URLs next to the sitemap, and the `hub` link lets
 * a deploy push a change through WebSub instead of waiting for the next sitemap
 * read. Prerendered: it reads
 * nothing from the request, only the page data the build already holds.
 */
function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function entries(): string {
  return FOOD_PAGE_LOCALES.flatMap((locale) =>
    pagesOf(locale).map((page) => {
      const url = `${SITE_URL}${foodPagePath(page.locale, page.slug)}`;
      const span = kcalSpan(page.capture, page.locale);
      return `<entry xml:lang="${locale}"><id>${url}</id><title>${xml(page.metaTitle(span))}</title><link href="${url}"/><updated>${page.capture.capturedAt}</updated><summary>${xml(page.description(span))}</summary></entry>`;
    })
  ).join('\n');
}

export function GET() {
  const updated = FOOD_PAGE_LOCALES.map((l) => captureDateRange(l).last)
    .sort()
    .at(-1);
  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>${SITE_URL}${foodHubPath('en')}</id>
<title>Kallo: calories in real meals</title>
<updated>${updated}</updated>
<author><name>Kallo</name></author>
<link rel="self" href="${SITE_URL}/feed.xml"/>
<link rel="hub" href="https://pubsubhubbub.appspot.com/"/>
<link href="${SITE_URL}${foodHubPath('en')}"/>
${entries()}
</feed>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
}
