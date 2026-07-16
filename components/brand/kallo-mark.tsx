import { KALLO_MARK_D, KALLO_MARK_VIEWBOX } from '@/lib/brand/kallo';

/**
 * The Kallo mark alone (segmented K) for icons and tight spaces where the
 * full wordmark does not fit. Inherits color via currentColor.
 */
export function KalloMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={KALLO_MARK_VIEWBOX}
      className={className}
      role="img"
      aria-label="Kallo"
      fill="currentColor"
    >
      <path d={KALLO_MARK_D} />
    </svg>
  );
}
