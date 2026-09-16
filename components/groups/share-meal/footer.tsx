'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The dialog's footer: the primary, and the cancel a desktop user expects.
 *
 * The button carries the whole consequence of the share — what you keep — so
 * there is no separate warning line above it.
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
    <div className="mt-4 flex items-center justify-end gap-3 border-kallo-border/60 border-t px-[22px] py-3.5">
      <Button onClick={onCancel} variant="outline">
        {cancelLabel}
      </Button>
      <Button disabled={disabled || pending} onClick={onShare}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {label}
      </Button>
    </div>
  );
}
