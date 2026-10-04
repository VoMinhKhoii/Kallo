'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useAccountSearch } from '@/hooks/admin/use-account-search';
import { MAX_PICKED_ACCOUNTS } from '@/lib/admin/premium/targets/who-input';
import { cn } from '@/lib/core/ui/cn';
import { PlanBadge } from '../shared/plan-badge';

export interface PickedAccount {
  id: string;
  label: string;
}

interface AccountPickerProps {
  picked: PickedAccount[];
  onChange: (next: PickedAccount[]) => void;
}

/** Search by name, email or handle; pick as many as needed. */
export function AccountPicker({ picked, onChange }: AccountPickerProps) {
  const [query, setQuery] = useState('');
  const search = useAccountSearch(query);
  const pickedIds = new Set(picked.map((p) => p.id));
  const results = (search.data ?? []).filter((m) => !pickedIds.has(m.id));
  const full = picked.length >= MAX_PICKED_ACCOUNTS;

  return (
    <div className="flex flex-col gap-2">
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Picked accounts">
          {picked.map((account) => (
            <li
              key={account.id}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-kallo-track pr-1 pl-3 text-sm"
            >
              {account.label}
              <button
                type="button"
                aria-label={`Remove ${account.label}`}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-kallo-hover"
                onClick={() =>
                  onChange(picked.filter((p) => p.id !== account.id))
                }
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search accounts"
        disabled={full}
      />
      {query.trim().length >= 2 && (
        <ul className="max-w-2xl overflow-hidden rounded-xl border bg-card">
          {search.isPending && (
            <li className="px-4 py-3 text-muted-foreground text-sm">
              Searching…
            </li>
          )}
          {search.isError && (
            <li className="px-4 py-3 text-kallo-danger text-sm">
              {search.error.message}
            </li>
          )}
          {search.isSuccess && results.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground text-sm">
              No other accounts match.
            </li>
          )}
          {results.map((match) => {
            const paying = match.plan === 'paying';
            return (
              <li key={match.id}>
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => {
                    onChange([
                      ...picked,
                      { id: match.id, label: match.name ?? match.email },
                    ]);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                    paying
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-kallo-hover'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">
                      {match.name ?? match.email}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {match.email}
                    </span>
                  </span>
                  <PlanBadge plan={match.plan} freeUntil={match.freeUntil} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">
        Each result shows what they have now. Paying accounts can't be picked.
      </p>
    </div>
  );
}
