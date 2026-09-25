import { cn } from '@/lib/core/ui/cn';

/**
 * The Premium chip's stand-in on an icon-only button, where a word would not
 * fit: a 7px blue dot with a 2px white ring, pinned to the icon's top-right
 * corner. The parent must be `relative` and wrap the icon tightly.
 *
 * Decorative — the button's own label names the action, and tapping it goes to
 * /pricing, which says what it costs.
 */
export function PremiumDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-premium-dot=""
      className={cn(
        'pointer-events-none absolute -top-[3px] -right-[3px] size-[7px] rounded-full bg-kallo-premium-dot ring-2 ring-white',
        className
      )}
    />
  );
}
