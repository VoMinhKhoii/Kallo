'use client';

interface DashboardSectionStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function DashboardSectionState({
  message,
  actionLabel,
  onAction,
}: DashboardSectionStateProps) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-[1.375rem] border border-kallo-border/60 bg-card p-4 text-center text-kallo-text-muted text-sm shadow-[0_10px_32px_rgba(44,36,22,0.05)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.15)]">
      <p className="max-w-sm">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-kallo-btn px-4 py-2 font-medium text-white text-xs transition-colors hover:bg-kallo-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/60"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
