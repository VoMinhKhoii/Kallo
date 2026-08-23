import { type Locale, locales } from '@/i18n/config';
import { renderDocMarkdown } from '@/lib/domain/docs/markdown/render';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';
import { renderLandingMarkdown } from '@/lib/seo/markdown/landing';
import { renderNotFoundMarkdown } from '@/lib/seo/markdown/not-found';

/**
 * Every `text/markdown` representation the site serves.
 *
 * Not linked from anywhere and not in the sitemap: `middleware.ts` rewrites
 * here when a client asks for Markdown (or appends `.md` to a page URL), so the
 * canonical URL never changes and there is no second indexable copy of the docs.
 *
 * `force-static` + a complete `generateStaticParams` is load-bearing, not an
 * optimisation. `renderDocMarkdown` reads `.mdx` files out of `content/`, and
 * `content/` is NOT copied into the standalone Docker image — so every one of
 * these must be rendered at build time or it would ENOENT in production.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => [
    { locale, slug: ['index'] },
    { locale, slug: ['not-found'] },
    ...DOCS_SLUGS.map((docSlug) => ({
      locale,
      slug: ['docs', ...docSlug.split('/')],
    })),
  ]);
}

function markdown(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // The canonical URL serves HTML to browsers and this to agents, so a
      // cache that keys on the URL alone would hand one audience the other's
      // bytes. `middleware.ts` sets the same header on the HTML side.
      Vary: 'Accept, Accept-Encoding',
      // The canonical URL for this content is the HTML page; middleware rewrites
      // here rather than redirecting, so /md/* is an implementation detail that
      // happens to be reachable. Keep it out of the index so it can never
      // compete with the page it represents.
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
): Promise<Response> {
  const { locale, slug } = await params;
  if (!locales.includes(locale as Locale)) {
    return markdown(renderNotFoundMarkdown('en'), 404);
  }
  const typedLocale = locale as Locale;

  const [head, ...rest] = slug;

  if (head === 'not-found') {
    return markdown(renderNotFoundMarkdown(typedLocale), 404);
  }
  if (head === 'index' && rest.length === 0) {
    return markdown(await renderLandingMarkdown(typedLocale), 200);
  }
  if (head === 'docs') {
    const body = await renderDocMarkdown(typedLocale, rest.join('/'));
    if (body) return markdown(body, 200);
  }

  return markdown(renderNotFoundMarkdown(typedLocale), 404);
}
