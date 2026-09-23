'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useResetOnReveal } from '@/hooks/ui/use-reset-on-reveal';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
} from '@/lib/admin/queries/feedback';
import { updateFeedbackStatus } from '@/lib/admin/triage/update-feedback-status';

export function StatusForm({ id, current }: { id: string; current: string }) {
  const [status, setStatus] = useState(current);
  // Kept alive across navigations under Cache Components: when the page comes
  // back with a different stored status (changed in another tab or by another
  // admin), show it instead of the selection from the earlier visit.
  const [seenCurrent, setSeenCurrent] = useState(current);
  if (current !== seenCurrent) {
    setSeenCurrent(current);
    setStatus(current);
  }
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The page is kept alive (hidden) across navigations under Cache
  // Components; a "Saved" or error note from an earlier visit — or from an
  // update that finished after the admin left — is stale by the time they
  // come back, so clear both when the page is shown again.
  useResetOnReveal(() => {
    setSaved(false);
    setError(null);
  });

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateFeedbackStatus({ id, status });
        setSaved(true);
      } catch {
        setError('Failed to save. Please try again.');
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          setSaved(false);
          setError(null);
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FEEDBACK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {FEEDBACK_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        onClick={save}
        disabled={pending || status === current}
      >
        {pending ? 'Saving…' : 'Update'}
      </Button>
      {saved && !pending && (
        <span className="text-green-600 text-xs dark:text-green-400">
          Saved
        </span>
      )}
      {error && (
        <span role="alert" className="text-red-600 text-xs dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
