import { Skeleton } from '@/components/ui/skeleton';
import type { HeatmapRange } from '@/lib/types/dashboard';

export function HeatmapSkeleton({ range }: { range: HeatmapRange }) {
  const cols = range === '30d' ? 5 : range === '90d' ? 14 : 53;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-1 items-center gap-1">
        <div className="flex shrink-0 flex-col gap-1" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton
              key={i}
              className="h-[19px] w-3 rounded-sm bg-kallo-track motion-reduce:animate-none"
            />
          ))}
        </div>
        <div
          className="grid flex-1 gap-1"
          style={{
            gridTemplateRows: 'repeat(7, 19px)',
            gridAutoFlow: 'column',
            gridAutoColumns: '19px',
          }}
          aria-hidden="true"
        >
          {Array.from({ length: cols * 7 }, (_, i) => (
            <Skeleton
              key={i}
              className="h-[19px] w-[19px] rounded-[3px] bg-kallo-track motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-12 rounded-full bg-kallo-track motion-reduce:animate-none" />
        <Skeleton className="h-1.5 flex-1 rounded-full bg-kallo-track motion-reduce:animate-none" />
        <Skeleton className="h-2 w-12 rounded-full bg-kallo-track motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function ProgressSectionSkeleton({ range }: { range: HeatmapRange }) {
  const cols = range === '30d' ? 5 : range === '90d' ? 14 : 53;

  return (
    <div className="flex h-full gap-3">
      <div className="flex flex-1 flex-col rounded-2xl border border-kallo-border/60 bg-card p-3 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1 h-3 w-28 rounded-full bg-kallo-track motion-reduce:animate-none" />
        <Skeleton className="min-h-[220px] w-full flex-1 rounded-xl bg-kallo-track motion-reduce:animate-none" />
      </div>
      <div className="flex shrink-0 flex-col rounded-2xl border border-kallo-border/60 bg-card px-3 pt-3 pb-2 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1.5 h-3 w-28 rounded-full bg-kallo-track motion-reduce:animate-none" />
        <div className="flex flex-1 items-center gap-1">
          <div className="flex shrink-0 flex-col gap-1" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[19px] w-3 rounded-sm bg-kallo-track motion-reduce:animate-none"
              />
            ))}
          </div>
          <div
            className="grid flex-1 gap-1"
            style={{
              gridTemplateRows: 'repeat(7, 19px)',
              gridAutoFlow: 'column',
              gridAutoColumns: '19px',
            }}
            aria-hidden="true"
          >
            {Array.from({ length: cols * 7 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[19px] w-[19px] rounded-[3px] bg-kallo-track motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-2 w-12 rounded-full bg-kallo-track motion-reduce:animate-none" />
          <Skeleton className="h-1.5 flex-1 rounded-full bg-kallo-track motion-reduce:animate-none" />
          <Skeleton className="h-2 w-12 rounded-full bg-kallo-track motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
