'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/infra/monitoring/report-error';

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry` (stable in Next 16.3) re-fetches the segment from the server and
  // re-renders it; `reset` only re-rendered what the client already had,
  // which cannot recover from a failed server render — the common case here.
  retry: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('[admin] route error', error);
    reportError(error, '[admin]');
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center">
      <SurfaceState
        action={
          <Button onClick={() => retry()} size="sm" variant="ink">
            {t('route.retry')}
          </Button>
        }
        area="system"
        kind="error"
        subtitle={error.message || t('route.body')}
        title={t('route.title')}
      />
      {error.digest && (
        <p className="text-muted-foreground text-xs">digest: {error.digest}</p>
      )}
    </div>
  );
}
