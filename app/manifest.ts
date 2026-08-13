import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    // The manifest is served once at the origin root with no locale segment, so
    // it cannot follow `metadata.root` per locale the way <title> does. It takes
    // the English/global wording — the same choice the `en` metadata makes.
    name: 'Kallo — AI Nutrition Tracker',
    short_name: 'Kallo',
    description:
      'Describe what you ate in your own words — Kallo derives the full nutrition breakdown from trusted data.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#fcfcfc',
    theme_color: '#fcfcfc',
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
