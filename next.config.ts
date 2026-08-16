import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import pkg from './package.json';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // OCR sends at most 4 MiB of decoded image bytes as base64 (~5.34 MiB).
    serverActions: { bodySizeLimit: '6mb' },
  },
  // Surfaced to the client so in-app feedback can record which app version a
  // report came from.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  async redirects() {
    return [
      // The routed settings tabs were flattened into one anchored page;
      // keep old deep links (bookmarks, PWA shortcuts) working forever.
      {
        source: '/:locale(en|vi)/settings/profile',
        destination: '/:locale/settings',
        permanent: true,
      },
      {
        source: '/:locale(en|vi)/settings/account',
        destination: '/:locale/settings#settings-account',
        permanent: true,
      },
      // The legal pages moved into the docs site. These redirects are
      // load-bearing, not tidiness: the Flutter About screen and the App Store
      // / Google Play listings point at kallo.fit/privacy and /terms, and a
      // store listing URL cannot be changed retroactively for installed apps.
      {
        source: '/:locale(en|vi)/terms',
        destination: '/:locale/docs/legal/terms',
        permanent: true,
      },
      {
        source: '/:locale(en|vi)/privacy',
        destination: '/:locale/docs/legal/privacy',
        permanent: true,
      },
      // The docs hub was removed — the footer carries the full tree, so a
      // landing page listing it again was a second copy of the same thing.
      // /docs stays a working URL because it is the one people type, and the
      // landing footer, the header lockup and every breadcrumb used to point
      // at it. Not `permanent`: if a hub ever comes back, a 308 cached in
      // every visitor's browser would be very hard to undo.
      {
        source: '/:locale(en|vi)/docs',
        destination: '/:locale/docs/overview',
        permanent: false,
      },
    ];
  },
};

// Docs pages are authored as MDX under /content and imported by the
// `app/[locale]/docs/[...slug]` route — they are never routed as pages, so
// `pageExtensions` stays untouched.
//
// Every plugin is referenced by NAME, not by an imported function. Turbopack
// (the Next 16 default) serializes loader options, so a function value cannot
// survive the hop; `@next/mdx`'s loader resolves these strings itself, which
// keeps one config working under both Turbopack and webpack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [
      'remark-gfm',
      'remark-frontmatter',
      ['remark-mdx-frontmatter', { name: 'frontmatter' }],
    ],
    rehypePlugins: [
      'rehype-slug',
      [
        'rehype-autolink-headings',
        {
          behavior: 'append',
          // The anchor is decoration for pointer users; it carries no
          // information a screen reader or keyboard user needs, and the
          // heading text is already the link target.
          properties: {
            className: ['heading-anchor'],
            tabIndex: -1,
            'aria-hidden': 'true',
          },
          content: {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: [{ type: 'text', value: '#' }],
          },
        },
      ],
    ],
  },
});

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(withMDX(nextConfig));
