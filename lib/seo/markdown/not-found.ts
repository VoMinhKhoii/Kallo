import type { Locale } from '@/i18n/config';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The `text/markdown` body for a 404.
 *
 * The point is recovery, not apology: an agent that guessed a URL wrong needs
 * the three entry points that let it find the right one without crawling the
 * site — the docs index, the sitemap, and the API spec. The HTML 404 at
 * `app/[locale]/not-found.tsx` carries the same links for human readers.
 */
export function renderNotFoundMarkdown(locale: Locale): string {
  const base = `${SITE_URL}/${locale}`;

  return `# 404 — Page not found

There is no page at this URL. Nothing was moved; this path never existed.

## Where to look instead

- [${SITE_URL}/llms.txt](${SITE_URL}/llms.txt) — every documentation page, one link per line. Start here.
- [${SITE_URL}/sitemap.xml](${SITE_URL}/sitemap.xml) — every public URL, both languages.
- [${base}/docs/overview](${base}/docs/overview) — what Kallo is.
- [${SITE_URL}/openapi.json](${SITE_URL}/openapi.json) — the HTTP API.
- [${base}/docs/developers/agents](${base}/docs/developers/agents) — how to use Kallo programmatically.

Any documentation page also serves Markdown directly: send \`Accept: text/markdown\`, or append \`.md\` to its URL.
`;
}
