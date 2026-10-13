'use client';

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type { MouseEvent, ReactNode } from 'react';
import { dialogShell } from '@/components/shared/dialog-shell/dialog-shell';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/ui/cn';

interface ConfirmDialogProps {
  /** The control that opens it. Omit when `open` is driven by the caller. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** `destructive` fills the action in error red — for a step that deletes. */
  tone?: 'default' | 'destructive';
  /** Disables the action while the caller's work is in flight. */
  pending?: boolean;
  /**
   * Runs on the action. The dialog closes after it unless the handler calls
   * `event.preventDefault()` — how a caller keeps it open until its mutation
   * settles.
   */
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * The app's one "are you sure?". Its card and title come from `dialogShell`,
 * the same as `ResponsiveModal` (Log weight), so every dialog matches — with
 * the answer as the only filled button (umber, or error red when it deletes)
 * and Cancel as bare text that only takes a wash on hover.
 */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}
      <AlertDialogContent
        className={cn(dialogShell.card, 'gap-5 p-[22px] sm:max-w-md')}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className={dialogShell.title}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription
            className={cn(dialogShell.description, 'leading-relaxed')}
          >
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* The Radix parts wrap OUR Button, not the other way round. The
              kit's AlertDialogAction/Cancel put Button outside a Slot, which
              joins class strings without merging them — so `bg-primary` and
              `bg-kallo-error` both landed and CSS order picked umber. Here
              the overrides go through Button's own `cn` and the last wins. */}
          <AlertDialogPrimitive.Cancel asChild>
            <Button
              variant="ghost"
              className="rounded-xl font-sans-display hover:bg-kallo-hover hover:text-kallo-text dark:hover:bg-kallo-hover"
            >
              {cancelLabel}
            </Button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action asChild>
            <Button
              disabled={pending}
              className={cn(
                'rounded-xl font-sans-display',
                tone === 'destructive' &&
                  'bg-kallo-error text-white hover:bg-kallo-error/90'
              )}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </AlertDialogPrimitive.Action>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
