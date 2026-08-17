import { cn } from '@/lib/core/ui/cn';

export type PipelineStatus = 'success' | 'error' | 'pending' | 'skipped';

export const STATUS_STYLES: Record<PipelineStatus, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  skipped: 'bg-muted text-muted-foreground',
};

export function StatusBadge({
  status,
  className,
}: {
  status: PipelineStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs',
        STATUS_STYLES[status] ?? STATUS_STYLES.skipped,
        className
      )}
    >
      {status}
    </span>
  );
}
