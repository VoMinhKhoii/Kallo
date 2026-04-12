export function MealEntryTotalSkeleton() {
  return (
    <div className="border-nham-border/50 border-t border-dashed pt-3">
      <div className="flex items-center justify-between">
        <span
          className="font-bold text-[13px] text-nham-text"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Total
        </span>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="h-3 w-8 animate-pulse rounded bg-nham-border/30" />
            <div className="h-3 w-8 animate-pulse rounded bg-nham-border/30" />
            <div className="h-3 w-8 animate-pulse rounded bg-nham-border/30" />
          </div>
          <div className="h-4 w-14 animate-pulse rounded bg-nham-border/40" />
        </div>
      </div>
    </div>
  );
}
