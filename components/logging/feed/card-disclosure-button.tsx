'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/core/ui/cn';

interface CardDisclosureButtonProps {
  /** Accessible name — the card's own "toggle details" string. */
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * The chevron that opens a meal card's details.
 *
 * Three cards rendered this identically — persisted, cheat and the staged
 * entry — so the fix lands once: a real 40x40 touch target (the design
 * system's minimum, and this is the control people reach for most on a phone),
 * and a focus ring, which none of the three had.
 *
 * `size-10` with `-m-2` is the repo's existing trick for this: the hit area
 * grows to 40px while the negative margin keeps the header row the height it
 * was, so nothing shifts. The visible wash grows with it, which makes the
 * affordance clearer rather than hiding it.
 */
export function CardDisclosureButton({
  label,
  isExpanded,
  onToggle,
  className,
}: CardDisclosureButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={isExpanded}
      onClick={onToggle}
      className={cn(
        '-m-2 flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-kallo-text-muted/60 transition-colors hover:bg-kallo-hover/40 hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface',
        className
      )}
    >
      <ChevronDown
        className={cn(
          'h-4 w-4 transition-transform duration-200',
          isExpanded && 'rotate-180'
        )}
      />
    </button>
  );
}
