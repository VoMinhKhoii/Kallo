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
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
} from '@/lib/admin/feedback-queries';
import { updateFeedbackStatus } from '../actions';

export function StatusForm({ id, current }: { id: string; current: string }) {
  const [status, setStatus] = useState(current);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
