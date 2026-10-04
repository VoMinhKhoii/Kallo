import type { RecentGrant } from '@/lib/admin/premium/recent-grants';

function formatDate(date: Date) {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export function RecentGrantsTable({ grants }: { grants: RecentGrant[] }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground">
      <div className="border-b px-5 py-3">
        <h2 className="font-semibold text-sm">Recent grants</h2>
      </div>
      {grants.length === 0 ? (
        <p className="px-5 py-4 text-muted-foreground text-sm">
          No Premium has been granted from this page yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className="px-5 py-2 font-medium">When (UTC)</th>
                <th className="px-5 py-2 font-medium">By</th>
                <th className="px-5 py-2 font-medium">Who</th>
                <th className="px-5 py-2 text-right font-medium">Days</th>
                <th className="px-5 py-2 font-medium">Until (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id} className="border-t">
                  <td className="px-5 py-2 tabular-nums">
                    {formatDate(grant.createdAt)}
                  </td>
                  <td className="px-5 py-2">{grant.adminEmail}</td>
                  <td className="px-5 py-2">
                    {grant.scope === 'everyone' ? 'Everyone' : 'Selected'} ·{' '}
                    {grant.userCount} account
                    {grant.userCount === 1 ? '' : 's'}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {grant.days}
                  </td>
                  <td className="px-5 py-2 tabular-nums">
                    {formatDate(grant.expiresAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
