'use client';

import { X } from 'lucide-react';

/**
 * The sheet header, structurally identical to the Flutter app's
 * `NhamSheetHeader`: close button on the LEFT, centered semibold title with an
 * optional centered subtitle, and a 48x48 spacer on the right so the title
 * stays optically centered against the close button.
 *
 * Type scale is the mobile one, so the two platforms read as one component:
 * title 17/600 (`dashValue` + w600), subtitle 12/400 muted (`dashMeta`).
 * Everything below this header follows the same 14px body / 12px meta rhythm.
 *
 * The grab handle is not drawn here — on the drawer it comes from vaul, and on
 * the desktop dialog there is nothing to drag.
 */
export function ResponsiveSheetHeader({
  title,
  subtitle,
  closeLabel,
  closeDisabled = false,
  onClose,
}: {
  title: string;
  subtitle?: string;
  closeLabel: string;
  closeDisabled?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1">
      <button
        type="button"
        aria-label={closeLabel}
        disabled={closeDisabled}
        onClick={onClose}
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-nham-text-muted transition-colors hover:bg-nham-hover hover:text-nham-text disabled:opacity-40"
      >
        <X className="size-[18px]" />
      </button>

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate font-semibold text-[17px] text-nham-text leading-tight">
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-nham-text-muted leading-snug">
            {subtitle}
          </p>
        )}
      </div>

      {/* Mirrors the close button so the title is centered on the sheet, not
          on the space left over beside it. */}
      <div className="size-12 shrink-0" aria-hidden="true" />
    </div>
  );
}
