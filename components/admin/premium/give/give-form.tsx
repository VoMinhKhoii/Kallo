'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  endFreePremiumAction,
  givePremiumAction,
  previewWhoAction,
} from '@/lib/admin/premium/actions/grant-actions';
import { cn } from '@/lib/core/ui/cn';
import { formatDay, plural } from '../shared/format';
import { ReasonDialog } from '../shared/reason-dialog';
import { LengthPicker, type LengthValue } from './length-picker';
import { toWhoInput, WhoPicker, type WhoValue } from './who-picker';

type Intent = 'give' | 'end';

const INITIAL_WHO: WhoValue = {
  kind: 'users',
  picked: [],
  group: { plan: 'free', joinedFrom: '', joinedTo: '' },
};

function toLength(value: LengthValue) {
  return value.unit === 'days'
    ? { unit: 'days' as const, days: value.days }
    : { unit: 'until' as const, until: value.until };
}

export function GiveForm() {
  const [intent, setIntent] = useState<Intent>('give');
  const [who, setWho] = useState<WhoValue>(INITIAL_WHO);
  const [length, setLength] = useState<LengthValue>({
    unit: 'days',
    days: '14',
  });
  const [mode, setMode] = useState<'extend' | 'restart'>('extend');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const everyone = who.kind === 'everyone';

  const review = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await previewWhoAction(toWhoInput(who));
        if (!result.success) return setError(result.error);
        if (result.accounts === 0) {
          return setError('No account matches — nothing would change.');
        }
        const skipped = result.payingSkipped
          ? ` · ${plural(result.payingSkipped, 'paying account')} skipped`
          : '';
        setPreview(`${plural(result.accounts, 'account')}${skipped}`);
        setConfirming(true);
      } catch {
        setError('Could not count the accounts. Try again.');
      }
    });

  const run = (reason: string, typed: string) =>
    startTransition(async () => {
      setConfirming(false);
      setError(null);
      const input = { who: toWhoInput(who), reason, confirm: typed };
      try {
        if (intent === 'give') {
          const result = await givePremiumAction({
            ...input,
            length: toLength(length),
            mode,
          });
          if (!result.success) return setError(result.error);
          toast.success(
            `Gave ${plural(result.userCount, 'account')} Premium, latest until ${formatDay(result.expiresAt)}.`
          );
        } else {
          const result = await endFreePremiumAction(input);
          if (!result.success) return setError(result.error);
          toast.success(
            `Ended free Premium for ${plural(result.userCount, 'account')}.`
          );
        }
        setWho(INITIAL_WHO);
      } catch {
        // It may have gone through before the connection dropped.
        setError('The request failed. Check Activity before you retry.');
      }
    });

  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card p-5 text-card-foreground">
      <div className="flex gap-2" role="group" aria-label="Action">
        {(['give', 'end'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={intent === value}
            onClick={() => setIntent(value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm hover:bg-kallo-hover',
              intent === value && 'bg-kallo-hover font-semibold'
            )}
          >
            {value === 'give' ? 'Give Premium' : 'End free Premium'}
          </button>
        ))}
      </div>

      <WhoPicker value={who} onChange={setWho} />

      {intent === 'give' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm">How long</span>
            <LengthPicker value={length} onChange={setLength} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm">
              If they already have free Premium
            </span>
            <div className="flex gap-2" role="group" aria-label="Mode">
              {(['extend', 'restart'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm hover:bg-kallo-hover',
                    mode === value && 'bg-kallo-hover font-semibold'
                  )}
                >
                  {value === 'extend' ? 'Add on top' : 'Start from today'}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Add on top: 5 days left + 14 = 19. An account keeps whichever of
              its grants runs longest; paid plans are never changed.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Cancels welcome and admin grants only. Anyone who pays keeps Premium.
          Every end can be undone from Activity.
        </p>
      )}

      {error && (
        <p role="alert" className="text-kallo-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end border-t pt-4">
        <Button type="button" onClick={review} disabled={pending}>
          {pending ? 'Checking…' : 'Review'}
        </Button>
      </div>

      <ReasonDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          intent === 'give' ? 'Give free Premium?' : 'End free Premium now?'
        }
        description={`This reaches ${preview ?? '…'}. It is recorded under your email and can be undone from Activity.`}
        confirmLabel={intent === 'give' ? 'Give Premium' : 'End free Premium'}
        confirmWord={
          everyone ? (intent === 'give' ? 'EVERYONE' : 'END') : undefined
        }
        onConfirm={run}
      />
    </div>
  );
}
