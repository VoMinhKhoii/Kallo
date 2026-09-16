'use client';

import { Loader2 } from 'lucide-react';
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
 */
export function ShareMealDialogFooter({
  label,
  cancelLabel,
  disabled,
  pending,
  onShare,
  onCancel,
}: {
  label: string;
  cancelLabel: string;
  disabled: boolean;
  pending: boolean;
  onShare: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogFooter className="mt-4 items-center border-kallo-border/60 border-t px-[22px] py-3.5">
      <Button onClick={onCancel} variant="outline">
        {cancelLabel}
      </Button>
      <Button disabled={disabled || pending} onClick={onShare}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {label}
      </Button>
    </DialogFooter>
  );
}
