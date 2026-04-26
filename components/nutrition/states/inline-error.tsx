'use client';

interface InlineErrorProps {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
  retryLabel: string;
}

export function InlineError({
  isRetrying,
  message,
  onRetry,
  retryLabel,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-nham-border/60 bg-card p-4 text-nham-text"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        aria-busy={isRetrying}
        className="mt-3 inline-flex touch-manipulation items-center rounded-xl border border-nham-border/60 px-4 py-2 font-medium text-nham-text text-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        {retryLabel}
      </button>
    </div>
  );
}
