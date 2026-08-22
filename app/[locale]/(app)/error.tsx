'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Route-group error boundary for every authenticated surface. Without this, a
 * server-side failure in dashboard/logging/nutrition/groups/settings rendered
 * Next's unstyled default screen inside the cream shell. This catches it in the
 * brand's calm first-person voice with a retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] route error', error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center font-sans-display"
      role="alert"
    >
      <h2 className="font-serif text-kallo-text text-xl">This didn’t load.</h2>
      <p className="max-w-sm text-[14px] text-kallo-text-muted leading-relaxed">
        Something went wrong on our side. Give it another try.
      </p>
      <Button onClick={() => reset()} variant="default" size="sm">
        Try again
      </Button>
    </div>
  );
}
