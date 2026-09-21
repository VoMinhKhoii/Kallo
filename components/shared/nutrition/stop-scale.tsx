import { cn } from '@/lib/core/ui/cn';

/**
 * Six dots filled up to the chosen stop — where on a slider's scale someone
 * landed, at a glance. A read-only echo of the live cheat slider, so a saved
 * occasion shows how much of each axis was claimed without redrawing the
 * control.
 *
 * Shared rather than feature-private because two surfaces draw it now: the
 * logger's own cheat card, and a friend's cheat post in the circle feed.
 * `components/groups/*` may not import from `components/logging/*`, so this
 * moved here instead of being reached across (AGENTS.md §5).
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
