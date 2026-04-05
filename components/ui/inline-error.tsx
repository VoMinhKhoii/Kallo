'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InlineErrorProps {
  message: string;
  retryable?: boolean;
  onRetry?: () => void;
}

export function InlineError({ message, retryable, onRetry }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {retryable && onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 gap-1 px-2"
        >
          <RefreshCw className="h-3 w-3" />
          Thử lại
        </Button>
      )}
    </div>
  );
}
