'use client';

import { Button } from '@/components/ui/button';

interface RetryActionProps {
  onRetry: () => void;
  isRetrying?: boolean;
  label: string;
}

/**
 * The one action a failed surface offers. Plain umber button, no icon: the
 * illustration is already the picture on this surface.
 */
export function RetryAction({ onRetry, isRetrying, label }: RetryActionProps) {
  return (
    <Button
      aria-busy={isRetrying}
      disabled={isRetrying}
      onClick={onRetry}
      size="sm"
      variant="ink"
    >
      {label}
    </Button>
  );
}
