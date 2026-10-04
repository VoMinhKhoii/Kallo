'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Typed confirmation word, for the actions that reach everyone. */
  confirmWord?: string;
  onConfirm: (reason: string, typed: string) => void;
}

/** Every admin change asks why; the reason lands in Activity. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmWord,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const ready =
    reason.trim().length >= 3 && (!confirmWord || typed.trim() === confirmWord);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setTyped('');
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex flex-col gap-1.5 text-sm">
          Reason (shown in Activity)
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Launch apology for the Oct 3 outage"
            maxLength={300}
          />
        </label>
        {confirmWord && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span>
              Type <span className="font-mono">{confirmWord}</span> to confirm
            </span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready}
            onClick={() => onConfirm(reason.trim(), typed.trim())}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
