'use client';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

/**
 * The dialog's footer: the primary, and the cancel a desktop user expects.
 *
 * The button carries the whole consequence of the share — what you keep — so
 * there is no separate warning line above it.
 *
 * Uses DialogFooter rather than a hand-rolled row: it stacks the two buttons
 * on a narrow viewport (`flex-col-reverse sm:flex-row`), which the version this
 * replaced did not, so the cancel and the primary sat squeezed side by side on
 * a phone browser.
 *
 * The primary overrides the button base's `whitespace-nowrap`: its label
 * carries a count AND a kcal figure, and in Vietnamese at a 320px viewport
 * that is wider than the row. `shrink-0` on the base means it cannot give way,
 * so the label wraps rather than running out of the card.
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
        className="h-auto min-h-9 min-w-0 whitespace-normal py-1.5 text-center"
        disabled={disabled}
        onClick={onShare}
      >
        {label}
      </Button>
    </DialogFooter>
  );
}
