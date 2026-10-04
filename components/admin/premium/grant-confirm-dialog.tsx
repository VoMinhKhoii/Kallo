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

// Typed confirmation for the one irreversible-at-scale action: granting every
// account. A stray click on the confirm button is not enough on its own.
const EVERYONE_PHRASE = 'everyone';

interface GrantConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'users' | 'everyone';
  days: number;
  emailCount: number;
  onConfirm: () => void;
}

export function GrantConfirmDialog({
  open,
  onOpenChange,
  scope,
  days,
  emailCount,
  onConfirm,
}: GrantConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const everyone = scope === 'everyone';
  const confirmed = !everyone || typed.trim().toLowerCase() === EVERYONE_PHRASE;
  const who = everyone
    ? 'every account, including ones that already pay'
    : `${emailCount} account${emailCount === 1 ? '' : 's'}`;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Grant {days} day{days === 1 ? '' : 's'} of Premium?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Goes to {who}, starting now. It cannot be undone from this page, and
            it is recorded under your email.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {everyone && (
          <label className="flex flex-col gap-1.5 text-sm">
            Type <span className="font-mono">{EVERYONE_PHRASE}</span> to confirm
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
            disabled={!confirmed}
            onClick={() => {
              setTyped('');
              onConfirm();
            }}
          >
            Grant Premium
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
