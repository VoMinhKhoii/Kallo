'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useAccountSearch } from '@/hooks/admin/use-account-search';
import { Link } from '@/i18n/navigation';
import { PlanBadge } from '../shared/plan-badge';

/** Look up an account by name, email or handle. */
export function AccountFinder() {
  const [query, setQuery] = useState('');
  const search = useAccountSearch(query);
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search accounts"
        autoFocus
      />
      {query.trim().length >= 2 && (
        <ul className="overflow-hidden rounded-xl border bg-card">
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
          {search.isSuccess && search.data.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground text-sm">
              No account matches.
            </li>
          )}
          {search.data?.map((match) => (
            <li key={match.id}>
              <Link
                href={`/admin/premium/accounts/${match.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-kallo-hover"
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
