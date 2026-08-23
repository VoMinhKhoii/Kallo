import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SITE_URL } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: '404 — Kallo',
  robots: { index: false, follow: true },
};

/**
 * The 404 page.
 *
 * It used to be the number and one line of text — a dead end for a reader and
 * a dead end for a crawler. A 404 is the one page whose whole job is recovery,
 * so it now carries the three entry points that let anyone find the right URL
 * without crawling the site: the docs, the machine-readable index, and the
 * sitemap. `lib/seo/markdown/not-found.ts` is the same content for a client
 * that asked for `text/markdown`; the two are meant to say the same thing.
 *
 * `follow: true` alongside `index: false` on purpose — do not index this page,
 * but do follow the links off it, which is the entire point of them.
 */
export default function NotFound() {
  const t = useTranslations('common');

  // Locale-relative — `Link` from i18n/navigation prefixes them.
  const pages = [
    { href: '/', label: t('notFoundHome') },
    { href: '/docs/overview', label: t('notFoundDocs') },
    { href: '/docs/company/contact', label: t('notFoundContact') },
  ];

  // Locale-agnostic machine files, so plain anchors rather than `Link`.
  const files = [
    { href: `${SITE_URL}/llms.txt`, label: t('notFoundIndex') },
    { href: `${SITE_URL}/sitemap.xml`, label: t('notFoundSitemap') },
    { href: `${SITE_URL}/openapi.json`, label: t('notFoundApi') },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="font-bold text-4xl">404</h1>
        <p className="mt-2 text-muted-foreground">{t('notFound')}</p>
        <p className="mt-4 text-muted-foreground text-sm">
          {t('notFoundBody')}
        </p>

        <h2 className="mt-10 font-medium text-sm">
          {t('notFoundWhereToLook')}
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {pages.map((page) => (
            <li key={page.href}>
              <Link className="underline underline-offset-4" href={page.href}>
                {page.label}
              </Link>
            </li>
          ))}
          {files.map((file) => (
            <li key={file.href}>
              <a className="underline underline-offset-4" href={file.href}>
                {file.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
