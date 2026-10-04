import { DOCK_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
import { sizeAtCap, stripHeight } from '@/lib/core/ui/gauge-strip-metrics';

/** The height the phone dock's stacked dial reserves before it measures. */
const STACKED_DIAL_HEIGHT = stripHeight(sizeAtCap(DOCK_MACRO_CAP, true));

/**
 * The phone Today dock while it loads: the stacked dial's exact footprint
 * (calorie arc over three macro arcs, no card — as `TodayDock` renders below
 * `md`), then the meals card. Shared by the route's `loading.tsx` and the
 * dashboard's own pending state, so neither hand-off moves the page.
 */
export function TodayDockSkeleton() {
  return (
    <div className="flex flex-col motion-safe:animate-pulse">
      <div
        className="flex flex-col items-center justify-between"
        style={{ height: STACKED_DIAL_HEIGHT, marginBottom: 20 }}
      >
        <div className="h-[132px] w-[200px] rounded-t-full bg-kallo-track" />
        <div className="flex gap-6">
          {['protein', 'carbs', 'fat'].map((key) => (
            <div
              key={key}
              className="h-[84px] w-[88px] rounded-t-full bg-kallo-track/70"
            />
          ))}
        </div>
      </div>
      <div className="mb-2 h-[25px] w-36 rounded-full bg-kallo-track" />
      {/* Three rows at a real row's height (~108px: name, kcal, composition
          bar, macros) — a typical day, so the list usually lands in place. */}
      <div className="divide-y divide-kallo-border/50 rounded-2xl bg-white px-4">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex h-[108px] flex-col justify-center gap-2.5"
          >
            <div className="h-4 w-3/5 rounded-full bg-kallo-track" />
            <div className="h-4 w-16 rounded-full bg-kallo-track/70" />
            <div className="h-1.5 w-full rounded-full bg-kallo-track/70" />
            <div className="h-3 w-4/5 self-center rounded-full bg-kallo-track/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
