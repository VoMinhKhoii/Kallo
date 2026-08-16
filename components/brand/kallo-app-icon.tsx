import { cn } from '@/lib/utils';
import { KalloMark } from './kallo-mark';

/**
 * The Kallo app icon as a UI element: cream segmented K on an espresso
 * rounded tile, matching the launcher icon. Size via className (the tile
 * keeps a square aspect); corner radius scales with the default rounded-2xl
 * unless overridden.
 */
export function KalloAppIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center rounded-2xl bg-kallo-text',
        className
      )}
    >
      <KalloMark className="h-1/2 w-auto text-kallo-surface" />
    </div>
  );
}
