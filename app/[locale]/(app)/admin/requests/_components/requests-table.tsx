import { Link } from '@/i18n/navigation';
import { formatUtcTimestamp } from '@/lib/admin/format';
import type { RequestListRow } from '@/lib/admin/queries';
import { StatusBadge } from '../../_components/status-badge';

interface RequestsTableProps {
  rows: RequestListRow[];
}

export function RequestsTable({ rows }: RequestsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-nham-text-muted text-sm">
        No requests found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-nham-border/60 bg-white/50 dark:bg-white/[0.02]">
      <table className="w-full font-sans-display text-sm">
        <thead className="border-nham-border/60 border-b bg-nham-track/50">
          <tr className="text-left text-nham-text-muted text-xs">
            <th className="px-4 py-2.5 font-medium">ID</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 font-medium">Input (preview)</th>
            <th className="px-4 py-2.5 font-medium">Created</th>
            <th className="px-4 py-2.5 font-medium">Replay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nham-border/40">
          {rows.map((row) => (
            <tr
              className="transition-colors hover:bg-nham-hover/50"
              key={row.id}
            >
              <td className="px-4 py-2.5">
                <Link
                  className="font-mono text-nham-accent text-xs hover:underline"
                  href={`/admin/requests/${row.id}`}
                >
                  {row.id.slice(0, 8)}…
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-2.5 text-nham-text-muted tabular-nums">
                {row.durationMs != null ? `${row.durationMs} ms` : '—'}
              </td>
              <td className="max-w-xs truncate px-4 py-2.5 text-nham-text">
                {row.rawInput.slice(0, 80)}
                {row.rawInput.length > 80 ? '…' : ''}
              </td>
              <td className="px-4 py-2.5 text-nham-text-muted tabular-nums">
                {formatUtcTimestamp(row.createdAt)}
              </td>
              <td className="px-4 py-2.5">
                {row.replayOfRequestId ? (
                  <Link
                    className="font-mono text-nham-text-muted text-xs hover:underline"
                    href={`/admin/requests/${row.replayOfRequestId}`}
                  >
                    {row.replayOfRequestId.slice(0, 8)}…
                  </Link>
                ) : (
                  <span className="text-nham-text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
