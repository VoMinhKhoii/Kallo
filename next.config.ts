import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
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
