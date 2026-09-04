'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('[admin] route error', error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center">
      <SurfaceState
        action={
          <Button onClick={() => reset()} size="sm" variant="ink">
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
