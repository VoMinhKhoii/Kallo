'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] route error', error);
  }, [error]);

  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center font-sans-display"
      role="alert"
    >
      <h2 className="font-lora font-semibold text-lg text-nham-text">
        Something went wrong
      </h2>
      <p className="max-w-md text-nham-text-muted text-sm">
        {error.message ||
          'An unexpected error occurred while loading admin data.'}
      </p>
      {error.digest && (
        <p className="text-nham-text-muted text-xs">digest: {error.digest}</p>
      )}
      <Button onClick={() => reset()} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}
