import { cn } from '@/lib/utils';

/**
 * The warm halo behind the meal composer.
 *
 * The composer is the one thing the logging page asks you to do, and it sat on
 * flat canvas — correct, and completely inert. The halo makes it the page's lit
 * surface without adding a border, a fill or a shadow to the input itself.
 *
 * Purely decorative: `aria-hidden`, and `pointer-events-none` so it never eats
 * a click meant for the field it sits under. The gradient lives in
 * `--nham-composer-glow` (light and dark) rather than here, so the colour
 * decision stays with the palette.
 */
export function ComposerGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        // Bleeds well past the input on every side — a halo cropped to the
        // input's own box reads as a rectangle, which is the one thing it must
        // not do.
        'pointer-events-none absolute -inset-x-16 -top-32 -bottom-12 z-0',
        className
      )}
      style={{ background: 'var(--nham-composer-glow)' }}
    />
  );
}
