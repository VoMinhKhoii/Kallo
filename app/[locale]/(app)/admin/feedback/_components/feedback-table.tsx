import { Paperclip } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  type FeedbackListRow,
} from '@/lib/admin/feedback-queries';
import { formatUtcTimestamp } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  ingredient:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  idea: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  triaged: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  resolved:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  wontfix: 'bg-muted text-muted-foreground',
};

export function FeedbackTable({ rows }: { rows: FeedbackListRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        No feedback found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Message
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Platform
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-muted/40">
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'inline-flex rounded px-1.5 py-0.5 font-medium text-xs',
                    TYPE_STYLES[row.type] ?? 'bg-muted text-foreground'
                  )}
                >
                  {FEEDBACK_TYPE_LABELS[row.type] ?? row.type}
                </span>
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'inline-flex rounded px-1.5 py-0.5 font-medium text-xs',
                    STATUS_STYLES[row.status] ?? 'bg-muted text-foreground'
                  )}
                >
                  {FEEDBACK_STATUS_LABELS[row.status] ?? row.status}
                </span>
              </td>
              <td className="max-w-md px-4 py-2">
                <Link
                  href={`/admin/feedback/${row.id}`}
                  className="flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                >
                  <span className="truncate">
                    {row.message.slice(0, 90)}
                    {row.message.length > 90 ? '…' : ''}
                  </span>
                  {row.screenshotPath && (
                    <Paperclip
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Has screenshot"
                    />
                  )}
                </Link>
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {row.platform ?? '—'}
                {row.locale ? ` · ${row.locale}` : ''}
              </td>
              <td className="px-4 py-2 text-muted-foreground tabular-nums">
                {formatUtcTimestamp(row.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
