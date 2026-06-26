import { HeatmapSkeleton } from '@/components/dashboard/progress/progress-section-skeleton';

export default function DashboardLoading() {
  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-nham-surface/30 font-sans-display xl:overflow-hidden"
      aria-busy="true"
    >
      <div className="min-h-full px-3 py-3 pb-24 sm:px-5 sm:py-4 lg:px-8 xl:h-full xl:min-h-0 xl:overflow-hidden xl:py-3 xl:pb-3">
        <div className="mx-auto grid max-w-[1440px] gap-4 sm:gap-5 xl:h-full xl:min-h-0 xl:grid-rows-[minmax(150px,0.78fr)_minmax(220px,1.1fr)_minmax(240px,1.12fr)] xl:gap-3">
          {/* Today — gentle line lives in the header band */}
          <section className="flex min-h-0 flex-col gap-1.5">
            <p className="font-serif text-nham-text-muted text-sm">
              Setting the table…
            </p>
            <div className="min-h-[150px] rounded-[1.5rem] border border-nham-border/60 bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:min-h-0 xl:flex-1">
              <div className="flex h-full items-center gap-5 motion-safe:animate-pulse">
                <div className="h-24 w-24 shrink-0 rounded-full bg-nham-track" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-32 rounded-full bg-nham-track" />
                  <div className="h-3 w-48 rounded-full bg-nham-track" />
                  <div className="h-3 w-40 rounded-full bg-nham-track" />
                </div>
              </div>
            </div>
          </section>

          {/* Progress */}
          <section className="flex min-w-0 flex-col gap-1.5 xl:min-h-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
                Progress
              </span>
              <div className="h-3 w-16 rounded-full bg-nham-track motion-safe:animate-pulse" />
            </div>
            <div className="min-h-[220px] rounded-[1.5rem] border border-nham-border/60 bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:min-h-0 xl:flex-1">
              <div className="h-full space-y-4 motion-safe:animate-pulse">
                <div className="h-3 w-24 rounded-full bg-nham-track" />
                <div className="h-8 w-40 rounded-full bg-nham-track" />
                <div className="h-32 w-full rounded-xl bg-nham-track" />
              </div>
            </div>
          </section>

          {/* Consistency — reuse the real heatmap skeleton */}
          <section className="flex min-w-0 flex-col gap-1.5 xl:min-h-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
                Consistency
              </span>
              <div className="h-3 w-16 rounded-full bg-nham-track motion-safe:animate-pulse" />
            </div>
            <div className="min-h-[310px] rounded-[1.5rem] border border-nham-border/60 bg-card p-3 shadow-[0_10px_32px_rgba(44,36,22,0.05)] sm:min-h-[340px] md:min-h-[360px] xl:min-h-0 xl:flex-1 xl:p-4">
              <HeatmapSkeleton range="30d" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
