'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FiltersFormProps {
  current: Record<string, string | undefined>;
}

export function FiltersForm({ current }: FiltersFormProps) {
  const router = useRouter();

  const [status, setStatus] = useState<string>(current.status ?? '');
  const [userId, setUserId] = useState<string>(current.userId ?? '');
  const [dateFrom, setDateFrom] = useState<string>(current.dateFrom ?? '');
  const [dateTo, setDateTo] = useState<string>(current.dateTo ?? '');
  const [includeReplays, setIncludeReplays] = useState<boolean>(
    current.includeReplays === 'true' || current.includeReplays === '1'
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (userId.trim()) params.set('userId', userId.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (includeReplays) params.set('includeReplays', 'true');
    params.set('page', '1');
    router.push(`/admin/requests?${params.toString()}`);
  }

  function handleReset() {
    setStatus('');
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setIncludeReplays(false);
    router.push('/admin/requests');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-4"
    >
      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User ID */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">User ID (UUID)</label>
        <Input
          className="w-72 font-mono text-xs"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">From</label>
        <Input
          type="date"
          className="w-36"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">To</label>
        <Input
          type="date"
          className="w-36"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Include replays */}
      <div className="flex items-center gap-2">
        <input
          id="includeReplays"
          type="checkbox"
          checked={includeReplays}
          onChange={(e) => setIncludeReplays(e.target.checked)}
          className="h-4 w-4 rounded border"
        />
        <label htmlFor="includeReplays" className="text-sm">
          Include replays
        </label>
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
