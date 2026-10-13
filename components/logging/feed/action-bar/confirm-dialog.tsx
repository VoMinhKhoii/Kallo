'use client';

import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  /** The control that opens it. */
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Fills the action in terracotta — for a step that throws something away. */
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * The one "are you sure?" in the app, dressed like its other dialogs: the
 * Lora title and white rounded card `ResponsiveModal` gives Log weight, and
 * the answer as the only filled button — the verb names what happens, so the
 * eye lands on it, while Cancel stays the quiet way back.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="gap-5 rounded-2xl border-kallo-border/60 bg-white p-[22px] text-kallo-text sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-serif text-[22px] leading-snug">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans-display text-[13px] text-kallo-text-muted leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl font-sans-display">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            className="rounded-xl font-sans-display"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
