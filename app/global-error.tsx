'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/infra/telemetry/monitoring/report-error';
import en from '@/messages/en/errors.json';
import vi from '@/messages/vi/errors.json';
import './globals.css';

/**
 * Last-resort boundary: catches an error thrown by the root layout itself
 * (`app/[locale]/layout.tsx`), which the route-group `error.tsx` files sit
 * inside of and so cannot catch. It replaces the whole document, so it renders
 * its own `<html>` and has no next-intl provider — the copy is read straight
 * from the same `errors.route` messages, picked by the URL's locale prefix.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = usePathname()?.startsWith('/vi') ? 'vi' : 'en';
  const copy = (locale === 'vi' ? vi : en).route;

  useEffect(() => {
    console.error('[global] root error', error);
    reportError(error, '[global]');
  }, [error]);

  return (
    <html lang={locale}>
      <body className="antialiased">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <SurfaceState
            action={
              <Button onClick={() => reset()} size="sm" variant="ink">
                {copy.retry}
              </Button>
            }
            area="system"
            kind="error"
            subtitle={copy.body}
            title={copy.title}
          />
        </main>
      </body>
    </html>
  );
}
