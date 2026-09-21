import { cn } from '@/lib/core/ui/cn';

/**
 * Six dots filled up to the chosen stop — where one cheat slider was left.
 *
 * Lived in `components/shared/nutrition/` for one commit, promoted when a
 * friend's cheat post in the circle feed was going to draw it too. That post
 * turned out not to need it: a cheat post is the ordinary post anatomy plus a
 * chip and an `≈`, and the slider recap stayed on the owner's own card. One
 * consumer again, so it is back beside it. Flutter twin: the `_Dots` row
 * inside `cheat_meal_expanded_details.dart`.
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
