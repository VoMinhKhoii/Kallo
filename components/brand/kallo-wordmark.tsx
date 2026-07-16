import { KALLO_WORDMARK_D, KALLO_WORDMARK_VIEWBOX } from '@/lib/brand/kallo';

/**
 * The Kallo wordmark. Its capital is the segmented K mark, so never render
 * KalloMark next to this component. Inherits color via currentColor.
 */
export function KalloWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={KALLO_WORDMARK_VIEWBOX}
      className={className}
      role="img"
      aria-label="Kallo"
      fill="currentColor"
    >
      <path d={KALLO_WORDMARK_D} />
    </svg>
  );
}
