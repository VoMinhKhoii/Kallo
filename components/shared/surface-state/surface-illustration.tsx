'use client';

import { useIsLateNight } from '@/hooks/ui/use-is-late-night';
import {
  pickIllustration,
  type SurfaceArea,
  type SurfaceKind,
} from '@/lib/brand/illustrations/cast';
import { cn } from '@/lib/core/ui/cn';

interface SurfaceIllustrationProps {
  area: SurfaceArea;
  kind: SurfaceKind;
  compact: boolean;
}

/**
 * The hand-drawn animal above a surface state: one pen line, primary ink, no
 * disc behind it. Decorative — the title carries the meaning — so it is hidden
 * from assistive tech entirely.
 */
export function SurfaceIllustration({
  area,
  kind,
  compact,
}: SurfaceIllustrationProps) {
  const lateNight = useIsLateNight();
  const art = pickIllustration(area, kind, lateNight);

  return (
    <svg
      aria-hidden="true"
      className={cn('w-auto text-kallo-text', compact ? 'h-16' : 'h-[120px]')}
      data-illustration={art.slug}
      fill="currentColor"
      focusable="false"
      viewBox={art.viewBox}
    >
      {art.paths.map((d, index) => (
        <path d={d} key={`${art.slug}-${index}`} />
      ))}
    </svg>
  );
}
