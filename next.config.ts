import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import pkg from './package.json';

const nextConfig: NextConfig = {
  output: 'standalone',
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
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);
