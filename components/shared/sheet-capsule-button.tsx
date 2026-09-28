'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * A sheet header's trailing action — "Edit", "Done", "Enter manually": a grey
 * capsule the height of the close circle beside it (the Flutter app's
 * `SheetCapsuleButton`), with an optional leading glyph.
 */
export function SheetCapsuleButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-kallo-segment px-3.5 font-semibold text-[16px] text-kallo-text transition-colors hover:bg-kallo-border disabled:text-kallo-text-muted disabled:opacity-60"
    >
      {Icon && <Icon className="size-4" strokeWidth={1.75} />}
      {label}
    </button>
  );
}
