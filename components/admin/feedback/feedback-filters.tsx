'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from '@/i18n/navigation';
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
} from '@/lib/admin/queries/feedback';

export function FeedbackFilters({
  current,
}: {
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [type, setType] = useState<string>(current.type ?? 'all');
  const [status, setStatus] = useState<string>(current.status ?? 'all');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (type && type !== 'all') params.set('type', type);
    if (status && status !== 'all') params.set('status', status);
    params.set('page', '1');
    router.push(`/admin/feedback?${params.toString()}`);
  }

  function handleReset() {
    setType('all');
    setStatus('all');
    router.push('/admin/feedback');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="filters-type" className="text-muted-foreground text-xs">
          Type
        </label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="filters-type" className="w-40">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="filters-status"
          className="text-muted-foreground text-xs"
        >
          Status
        </label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="filters-status" className="w-40">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {FEEDBACK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Filter
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
