import { Skeleton } from '@/components/ui/skeleton';
import type { HeatmapRange } from '@/lib/types/dashboard';

export function ProgressSectionSkeleton({ range }: { range: HeatmapRange }) {
  const heatmapSquares =
    range === '30d' ? 5 * 7 : range === '90d' ? 14 * 7 : 53 * 7;

  return (
    <div className="flex h-full gap-3">
      <div className="flex flex-1 flex-col rounded-2xl border border-nham-border/60 bg-card p-3 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1 h-3 w-28 rounded-full bg-nham-track" />
        <Skeleton className="min-h-[220px] w-full flex-1 rounded-xl bg-nham-track" />
      </div>
      <div className="flex shrink-0 flex-col rounded-2xl border border-nham-border/60 bg-card px-3 pt-3 pb-2 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1.5 h-3 w-28 rounded-full bg-nham-track" />
        <div className="flex flex-1 items-center gap-1">
          <div className="flex shrink-0 flex-col gap-1" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[19px] w-3 rounded-sm bg-nham-track"
              />
            ))}
          </div>
          <div className="grid flex-1 gap-1" aria-hidden="true">
            {Array.from({ length: heatmapSquares }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[19px] w-[19px] rounded-[3px] bg-nham-track"
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-2 w-12 rounded-full bg-nham-track" />
          <Skeleton className="h-1.5 flex-1 rounded-full bg-nham-track" />
          <Skeleton className="h-2 w-12 rounded-full bg-nham-track" />
        </div>
      </div>
    </div>
  );
}
