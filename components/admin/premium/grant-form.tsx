'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { GrantConfirmDialog } from '@/components/admin/premium/grant-confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  grantPremiumInputSchema,
  MAX_GRANT_DAYS,
  splitEmailList,
} from '@/lib/admin/premium/grant-input';
import { grantPremiumAction } from '@/lib/admin/premium/grant-premium-action';
import { cn } from '@/lib/core/ui/cn';

type Scope = 'users' | 'everyone';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'users', label: 'Specific accounts' },
  { value: 'everyone', label: 'Everyone' },
];

export function GrantForm() {
  const [scope, setScope] = useState<Scope>('users');
  const [emails, setEmails] = useState('');
  const [days, setDays] = useState('14');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const input =
    scope === 'users'
      ? { scope, days, emails: splitEmailList(emails) }
      : { scope, days };

  // Validate on the client only to catch typos before the dialog; the server
  // action re-parses with the same schema and is the real gate.
  const review = () => {
    const parsed = grantPremiumInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input.');
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const grant = () => {
    setConfirming(false);
    startTransition(async () => {
      const result = await grantPremiumAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const until = new Date(result.expiresAt).toLocaleDateString();
      toast.success(
        `Premium granted to ${result.userCount} account${result.userCount === 1 ? '' : 's'} until ${until}.`
      );
      setEmails('');
    });
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-white p-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-sm">Who gets Premium</legend>
        <div className="flex gap-2">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              onClick={() => {
                setScope(option.value);
                setError(null);
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-kallo-hover',
                scope === option.value && 'bg-kallo-hover font-semibold'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {scope === 'users' && (
        <label className="flex flex-col gap-1.5 text-sm">
          Account emails
          <Textarea
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            placeholder="one@example.com, two@example.com"
            rows={4}
          />
          <span className="text-muted-foreground text-xs">
            Separate with commas or new lines. Every email must belong to an
            account, or nothing is granted.
          </span>
        </label>
      )}

      <label className="flex w-40 flex-col gap-1.5 text-sm">
        Duration in days
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GRANT_DAYS}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="text-kallo-danger text-sm">
          {error}
        </p>
      )}

      <div>
        <Button type="button" onClick={review} disabled={pending}>
          {pending ? 'Granting…' : 'Review grant'}
        </Button>
      </div>

      <GrantConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        scope={scope}
        days={Number(days)}
        emailCount={new Set(splitEmailList(emails)).size}
        onConfirm={grant}
      />
    </div>
  );
}
