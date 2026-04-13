interface ProgressSectionProps {
  weightChart: React.ReactNode;
  heatmap: React.ReactNode;
}

export function ProgressSection({
  weightChart,
  heatmap,
}: ProgressSectionProps) {
  return (
    <div>
      {/* Fluid width: weight chart + heatmap side by side */}
      <div className="flex h-full gap-3">
        <div className="flex flex-1 flex-col rounded-2xl border border-nham-border/60 bg-card p-3 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
          <span className="mb-1 block font-bold text-[10px] text-nham-stone uppercase tracking-[0.15em]">
            Weight Trend
          </span>
          {weightChart}
        </div>
        <div className="flex shrink-0 flex-col rounded-2xl border border-nham-border/60 bg-card px-3 pt-3 pb-2 shadow-[0_4px_24px_rgba(44,36,22,0.04)] transition-all duration-300 ease-out">
          {heatmap}
        </div>
      </div>
    </div>
  );
}
