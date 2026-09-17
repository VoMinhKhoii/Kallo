'use client';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

/**
 * The dialog's footer: the primary, and the cancel a desktop user expects.
 *
 * The button carries the whole consequence of the share — what you keep — so
 * there is no separate warning line above it.
 *
 * Uses DialogFooter rather than a hand-rolled row, so the side-by-side layout
 * is the primitive's decision and not this footer's.
 *
 * The primary overrides two things from the button base: `whitespace-nowrap`,
 * because its label carries a count AND a kcal figure and in Vietnamese at a
 * 320px viewport that is wider than the row; and `shrink-0`, because a button
 * that cannot give way would push the row out of the card instead of wrapping.
 * Cancel keeps both — it is two syllables and should hold its width.
 */
export function ShareMealDialogFooter({
  label,
  cancelLabel,
  disabled,
  onShare,
  onCancel,
}: {
  label: string;
  cancelLabel: string;
  disabled: boolean;
  onShare: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogFooter className="mt-4 shrink-0 items-center border-kallo-border/60 border-t px-[22px] py-3.5">
      <Button onClick={onCancel} variant="outline">
        {cancelLabel}
      </Button>
      <Button
        className="h-auto min-h-9 min-w-0 shrink whitespace-normal py-1.5 text-center"
        disabled={disabled}
        onClick={onShare}
      >
        {label}
      </Button>
    </DialogFooter>
  );
}
