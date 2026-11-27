import { routing } from '@/i18n/routing';
import { ROBOTS_DISALLOWED_PREFIXES } from '@/lib/seo/private-paths';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The text of `/robots.txt` (`app/robots.txt/route.ts`), written by hand
 * rather than through Next's `robots.ts`, whose shape has no field for
 * `Content-Signal`.
 *
 * Content-Signal (contentsignals.org) says what the pages may be used for once
 * fetched: search results, answers an AI gives from them (`ai-input`), and
 * model training (`ai-train`). Every AI crawler already gets the pages; this
 * says plainly that all three are welcome.
 *
 * Authenticated app surfaces are disallowed. next-intl serves them under a
 * locale prefix (/en/dashboard, /vi/dashboard, …), and robots path matching is
 * a literal prefix from the start of the path, so each is listed per locale
 * rather than as a bare /dashboard. The list lives in `private-paths.ts`
 * because markdown content negotiation and the signed-out redirect need the
 * same set. No `Host` line: it is a Yandex-only directive that Google and Bing
 * ignore.
 */

export const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=yes';

export function robotsTxt(): string {
  const disallow = [
    // Machine + auth endpoints are locale-agnostic (excluded from next-intl
    // rewriting), so they are not locale-prefixed.
    '/api/',
    '/auth/',
    ...routing.locales.flatMap((locale) =>
      ROBOTS_DISALLOWED_PREFIXES.map((path) => `/${locale}${path}`)
    ),
  ];
  return [
    'User-Agent: *',
    `Content-Signal: ${CONTENT_SIGNAL}`,
    'Allow: /',
    ...disallow.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Sitemap: ${SITE_URL}/feed.xml`,
    '',
  ].join('\n');
}
