'use client';

import { ChevronLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The sheet header, structurally identical to the Flutter app's
 * `KalloSheetHeader`: a grey circle close (or back) on the LEFT, the 17/600
 * title centred on the sheet, and an optional trailing action — a
 * `SheetCapsuleButton` such as "Edit".
 *
 * Geometry is the app's, exactly: 36px controls 16px from the top and sides,
 * so a control's centre sits on the centre of the sheet's corner, and the same
 * 16px below them (68px in all).
 *
 * The title centres on the SHEET, not on the space left beside the controls:
 * the side columns are equal (`1fr auto 1fr`), whatever the trailing action's
 * width.
 *
 * There is no subtitle slot. A line under the title was, in every sheet that
 * had one, a restatement of the title or of the controls below it.
 *
 * The grab handle is not drawn here — on the drawer it comes from vaul, and on
 * the desktop dialog there is nothing to drag.
 */
export function ResponsiveSheetHeader({
  title,
  closeLabel,
  closeDisabled = false,
  onClose,
  onBack,
  backLabel,
  trailing,
}: {
  title: string;
  closeLabel: string;
  closeDisabled?: boolean;
  onClose: () => void;
  /** Turns the leading control into a back chevron — a sheet's second level. */
  onBack?: () => void;
  backLabel?: string;
  /** The right-hand action, usually a `SheetCapsuleButton`. */
  trailing?: ReactNode;
}) {
  const back = onBack !== undefined;
  const Glyph = back ? ChevronLeft : X;
  return (
    <div className="grid h-[68px] shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-2 px-4 pt-4">
      <button
        type="button"
        aria-label={back ? (backLabel ?? closeLabel) : closeLabel}
        disabled={closeDisabled}
        onClick={onBack ?? onClose}
        className="flex size-9 items-center justify-center justify-self-start rounded-full bg-kallo-segment text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-40"
      >
        <Glyph className="size-[18px]" strokeWidth={1.75} />
      </button>

      <p className="truncate pt-2 text-center font-semibold text-[17px] text-kallo-text leading-5">
        {title}
      </p>

      <div className="flex justify-self-end">{trailing}</div>
    </div>
  );
}
