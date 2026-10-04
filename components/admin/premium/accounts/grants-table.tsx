import type { AccountGrant } from '@/lib/admin/premium/accounts/lookup';
import { formatDay } from '../shared/format';

const KIND: Record<AccountGrant['kind'], string> = {
  welcome: 'Welcome offer',
  admin: 'Admin grant',
  promo: 'Promo',
  store: 'Paid',
};

function storeLabel(store: string | null): string {
  if (store === 'app_store') return 'App Store';
  if (store === 'play_store') return 'Google Play';
  return store ? 'Web' : 'Store';
}

export function GrantsTable({ grants }: { grants: AccountGrant[] }) {
  if (grants.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No Premium grants — this account has only ever been on Free.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 font-medium">Until</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => (
            <tr key={grant.id} className="border-t">
              <td className="px-3 py-2.5">
                {grant.kind === 'store'
                  ? `${KIND.store} · ${storeLabel(grant.store)}`
                  : KIND[grant.kind]}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {formatDay(grant.startsAt)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {grant.expiresAt ? formatDay(grant.expiresAt) : 'Lifetime'}
              </td>
              <td className="px-3 py-2.5">
                {grant.active
                  ? 'Active'
                  : grant.status === 'active'
                    ? 'Ended'
                    : grant.status === 'canceled'
                      ? 'Ended early'
                      : grant.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
