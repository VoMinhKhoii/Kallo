import { cn } from '@/lib/core/ui/cn';

/**
 * Six dots filled up to the chosen stop — where on a slider's scale the user
 * landed, at a glance. The persisted cheat card's read-only echo of the live
 * slider, so a saved occasion still shows how much of each axis was claimed
 * without redrawing the control.
 */
export function StopScale({ level, color }: { level: number; color: string }) {
  const filled = Math.min(6, Math.max(1, Math.round(level / 2) + 1));
  return (
    <span aria-hidden className="flex items-center gap-0.5">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i >= filled && 'border border-kallo-border'
          )}
          style={i < filled ? { backgroundColor: color } : undefined}
        />
      ))}
    </span>
  );
}
