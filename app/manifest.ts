import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'Nhẩm — Vietnamese Meal Tracker',
    short_name: 'Nhẩm',
    description: 'Track Vietnamese meals with AI-powered nutrition analysis',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#fefbf6',
    theme_color: '#fefbf6',
    orientation: 'portrait',
    shortcuts: [
      {
        name: 'Log a meal',
        short_name: 'Log',
        url: '/logging',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
