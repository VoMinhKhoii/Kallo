'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  endFreePremiumAction,
  givePremiumAction,
} from '@/lib/admin/premium/actions/grant-actions';
import { formatDay } from '../shared/format';
import { ReasonDialog } from '../shared/reason-dialog';

type Pending = { kind: 'give'; days: number } | { kind: 'end' } | null;

/** One account: add days on top of their free time, or end it now. */
export function QuickActions({
  userId,
  canEnd,
  paying,
}: {
  userId: string;
  canEnd: boolean;
  paying: boolean;
}) {
  const [action, setAction] = useState<Pending>(null);
  const [busy, startTransition] = useTransition();
  if (paying) {
    return (
      <p className="text-muted-foreground text-sm">
        This account pays. Its plan can only be managed in the store.
      </p>
    );
  }

  const run = (reason: string) =>
    startTransition(async () => {
      const current = action;
      setAction(null);
      if (!current) return;
      const who = { kind: 'users' as const, userIds: [userId] };
      if (current.kind === 'give') {
        const result = await givePremiumAction({
          who,
          reason,
          mode: 'extend',
          length: { unit: 'days', days: current.days },
        });
        if (!result.success) return void toast.error(result.error);
        toast.success(
          `Free Premium now runs until ${formatDay(result.expiresAt)}.`
        );
      } else {
        const result = await endFreePremiumAction({ who, reason });
        if (!result.success) return void toast.error(result.error);
        toast.success('Free Premium ended.');
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {[7, 14, 30].map((days) => (
          <Button
            key={days}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setAction({ kind: 'give', days })}
          >
            +{days} days
          </Button>
        ))}
      </div>
      {canEnd && (
        <Button
          type="button"
          variant="outline"
          className="self-start text-kallo-danger"
          disabled={busy}
          onClick={() => setAction({ kind: 'end' })}
        >
          End free Premium now
        </Button>
      )}
      <p className="text-muted-foreground text-xs">
        Days are added on top of any free time left. Every action asks for a
        reason and can be undone from Activity.
      </p>
      <ReasonDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action?.kind === 'give'
            ? `Add ${action.days} days of Premium?`
            : 'End free Premium now?'
        }
        description="This changes one account and is recorded under your email."
        confirmLabel={action?.kind === 'give' ? 'Add days' : 'End now'}
        onConfirm={run}
      />
    </div>
  );
}
