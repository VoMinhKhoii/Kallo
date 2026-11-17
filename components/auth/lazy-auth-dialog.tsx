'use client';

import dynamic from 'next/dynamic';

/**
 * The sign-in dialog, kept out of the page's first load.
 *
 * The dialog brings the forms and the `motion` library with it, and the public
 * pages that host it (landing, pricing, the food and tool pages) need neither
 * to show or hydrate, so importing it directly put all of that ahead of their
 * first paint on a slow phone. Client-only: it renders nothing until opened,
 * and its chunk is fetched as the page hydrates, so it is ready by the time a
 * button can be clicked.
 */
export const LazyAuthDialog = dynamic(
  () => import('@/components/auth/auth-dialog').then((m) => m.AuthDialog),
  { ssr: false }
);
