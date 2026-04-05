import type { StreamStatus } from '@/lib/ai/streaming/types';

const STAGE_LABELS: Record<string, string> = {
  connecting: 'Connecting...',
  decomposing: 'Breaking down your meal...',
  matching: 'Matching ingredients...',
  estimating: 'Estimating nutrition...',
  assembling: 'Putting it all together...',
};

interface AnalysisStageBannerProps {
  status: StreamStatus;
  items: string[];
}

export function AnalysisStageBanner({
  status,
  items,
}: AnalysisStageBannerProps) {
  if (status === 'idle' || status === 'done' || status === 'error') {
    return null;
  }

  const label = STAGE_LABELS[status] ?? 'Analyzing...';

  return (
    <div className="group relative">
      <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
      <div className="absolute top-2 -left-[43px] h-2 w-2 animate-pulse rounded-full border-2 border-nham-accent bg-nham-accent/30" />
      <div className="rounded-2xl border border-nham-border/30 bg-white p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-nham-accent border-t-transparent" />
          <span className="font-medium text-nham-text-muted text-sm">
            {label}
          </span>
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item}
                className="rounded-full bg-nham-accent/10 px-2.5 py-0.5 text-nham-accent text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
