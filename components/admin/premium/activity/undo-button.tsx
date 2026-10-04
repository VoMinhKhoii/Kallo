'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { undoAdminAction } from '@/lib/admin/premium/actions/undo-action';
import { plural } from '../shared/format';
import { ReasonDialog } from '../shared/reason-dialog';

/** Reverses exactly what one earlier action did. */
export function UndoButton({ actionId }: { actionId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const undo = (reason: string) =>
    startTransition(async () => {
      setOpen(false);
      try {
        const result = await undoAdminAction({ actionId, reason });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.userCount > 0
            ? `Undone for ${plural(result.userCount, 'account')}.`
            : 'Undone.'
        );
      } catch {
        toast.error('The undo failed. Refresh Activity before you retry.');
      }
    });

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending ? 'Undoing…' : 'Undo'}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title="Undo this action?"
        description="Grants it created are canceled, grants it ended come back, or the welcome offer returns to how it was. The undo is logged too."
        confirmLabel="Undo"
        onConfirm={undo}
      />
    </>
  );
}
