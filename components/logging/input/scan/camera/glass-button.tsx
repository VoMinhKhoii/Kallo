'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/core/ui/cn';

/** Dark glass: ink at 38%, reads over a white carton and a dark counter. */
export const SCAN_GLASS = 'bg-[rgba(20,20,19,0.38)]';

/**
 * A round dark-glass control over the camera — close, the light, the bottom
 * tools — the Flutter app's `ScanGlassButton`. With `captioned`, the label is
 * also written under the disc and is part of the target: people click
 * "Type barcode", not just its icon.
 */
export function ScanGlassButton({
  icon: Icon,
  label,
  onClick,
  size = 44,
  captioned = false,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  size?: number;
  captioned?: boolean;
  /** The light while it is on: the disc turns white and the glyph ink. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 text-white',
        captioned && 'w-24'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full transition-colors',
          active ? 'bg-white text-kallo-text' : SCAN_GLASS
        )}
        style={{ width: size, height: size }}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      {captioned && (
        <span aria-hidden className="truncate text-[12px] leading-4">
          {label}
        </span>
      )}
    </button>
  );
}
