'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { saveWelcomeOfferAction } from '@/lib/admin/premium/actions/offer-action';
import { formatDay } from '../shared/format';
import { ReasonDialog } from '../shared/reason-dialog';

export interface OfferFormValue {
  enabled: boolean;
  /** As typed; validated on save. */
  days: string;
  /** YYYY-MM-DD or '' */
  autoOffOn: string;
}

const DAY_MS = 86_400_000;

/** The welcome offer for new signups. Never touches existing grants. */
export function OfferForm({ saved }: { saved: OfferFormValue }) {
  const [value, setValue] = useState(saved);
  // Re-sync when the saved offer changes (another admin, an undo).
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setValue(saved);
  }
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty =
    value.enabled !== saved.enabled ||
    value.days !== saved.days ||
    value.autoOffOn !== saved.autoOffOn;
  const days = Number(value.days);
  // The trigger stops granting from the start of the auto-off day (UTC).
  const today = new Date().toISOString().slice(0, 10);
  const autoOffPassed = value.autoOffOn !== '' && value.autoOffOn <= today;
  const sample =
    value.enabled &&
    !autoOffPassed &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= 365
      ? `Premium until ${formatDay(new Date(Date.now() + days * DAY_MS))}`
      : 'Nothing — the offer is off';

  const save = (reason: string) =>
    startTransition(async () => {
      setConfirming(false);
      setError(null);
      try {
        const result = await saveWelcomeOfferAction({
          enabled: value.enabled,
          days: value.days,
          autoOffOn: value.autoOffOn || null,
          reason,
        });
        if (!result.success) return setError(result.error);
        toast.success('Welcome offer saved. It applies to the next signup.');
      } catch {
        setError('Saving failed. Refresh to see the current offer.');
      }
    });

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 text-card-foreground">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-base">
            Welcome offer for new signups
          </h2>
          <p className="text-muted-foreground text-sm">
            Accounts created while this is on get free Premium from signup.
            Turning it off never takes Premium away from anyone.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          {value.enabled ? 'On' : 'Off'}
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => setValue({ ...value, enabled })}
            aria-label="Welcome offer on"
          />
        </label>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          Length in days
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={value.days}
            onChange={(e) => setValue({ ...value, days: e.target.value })}
          />
          <span className="text-muted-foreground text-xs">1–365.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Turn off automatically on
          <Input
            type="date"
            value={value.autoOffOn}
            onChange={(e) => setValue({ ...value, autoOffOn: e.target.value })}
          />
          <span className="text-muted-foreground text-xs">
            Optional. Leave empty to run until you switch it off.
          </span>
        </label>
        <div className="flex flex-col gap-1.5 text-sm">
          Someone signing up now gets
          <div className="flex h-9 items-center rounded-md bg-kallo-track px-3">
            {sample}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-kallo-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || pending}
          onClick={() => setValue(saved)}
        >
          Discard
        </Button>
        <Button
          type="button"
          disabled={!dirty || pending}
          onClick={() => setConfirming(true)}
        >
          Save offer
        </Button>
      </div>
      <ReasonDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Save the welcome offer?"
        description="It applies to signups from now on. Existing grants are not changed."
        confirmLabel="Save offer"
        onConfirm={save}
      />
    </section>
  );
}
