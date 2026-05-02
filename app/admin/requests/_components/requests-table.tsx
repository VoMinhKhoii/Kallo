import Link from 'next/link';
import { formatUtcTimestamp } from '@/lib/admin/format';
import type { RequestListRow } from '@/lib/admin/queries';
import { cn } from '@/lib/utils';

interface RequestsTableProps {
  rows: RequestListRow[];
}

const STATUS_STYLES: Record<string, string> = {
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export function RequestsTable({ rows }: RequestsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        No requests found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              ID
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Duration
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Input (preview)
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Created
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Replay
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-muted/40">
              <td className="px-4 py-2">
                <Link
                  href={`/admin/requests/${row.id}`}
                  className="font-mono text-blue-600 text-xs hover:underline dark:text-blue-400"
                >
                  {row.id.slice(0, 8)}…
                </Link>
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'inline-flex rounded px-1.5 py-0.5 font-medium text-xs',
                    STATUS_STYLES[row.status] ?? 'bg-muted text-foreground'
                  )}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground tabular-nums">
                {row.durationMs != null ? `${row.durationMs} ms` : '—'}
              </td>
              <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">
                {row.rawInput.slice(0, 80)}
                {row.rawInput.length > 80 ? '…' : ''}
              </td>
              <td className="px-4 py-2 text-muted-foreground tabular-nums">
                {formatUtcTimestamp(row.createdAt)}
              </td>
              <td className="px-4 py-2">
                {row.replayOfRequestId ? (
                  <Link
                    href={`/admin/requests/${row.replayOfRequestId}`}
                    className="font-mono text-muted-foreground text-xs hover:underline"
                  >
                    {row.replayOfRequestId.slice(0, 8)}…
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
