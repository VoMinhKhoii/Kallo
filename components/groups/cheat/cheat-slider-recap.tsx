import { StopScale } from '@/components/shared/nutrition/stop-scale';
import type { CheatRecapRow } from '@/lib/domain/cheat/feed-recap';
import { CHEAT_SLIDER_COLORS } from '@/lib/domain/cheat/slider-nutrition';

/**
 * Where the logger put each slider, as a friend sees it on their post.
 *
 * The read-only half of the owner's own "YOU SET" block
 * (`cheat-meal-card.tsx`), drawn from the same `StopScale` and the same
 * palette so a post and its author's card cannot look like different meals.
 * What it drops is the eyebrow label and the per-row layout that block uses
 * inside an expander — a feed post has no expander and no room for a
 * three-column row per axis.
 */
export function CheatSliderRecap({ rows }: { rows: CheatRecapRow[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {rows.map((row) => (
        <span
          className="flex items-center gap-1.5 font-sans-display text-[11.5px] text-kallo-text-muted"
          key={row.key}
        >
          <StopScale color={CHEAT_SLIDER_COLORS[row.key]} level={row.level} />
          <span className="truncate">{row.anchorLabel}</span>
        </span>
      ))}
    </div>
  );
}
