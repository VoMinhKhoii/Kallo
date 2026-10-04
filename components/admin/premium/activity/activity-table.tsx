import type { ActivityRow } from '@/lib/admin/premium/activity/list-activity';
import { formatDay, formatDayTime, plural } from '../shared/format';
import { UndoButton } from './undo-button';

interface OfferSnapshot {
  enabled: boolean;
  days: number;
  autoOffAt: string | null;
}

function describe(row: ActivityRow): { what: string; who: string } {
  const accounts = plural(row.userCount, 'account');
  const scope =
    row.scope === 'everyone'
      ? `Everyone · ${accounts}`
      : row.scope === 'group'
        ? `A group · ${accounts}`
        : accounts;
  switch (row.action) {
    case 'grant': {
      const length = row.days
        ? `+${row.days} days`
        : `until ${formatDay(row.expiresAt)}`;
      const mode = row.mode === 'restart' ? 'from today' : 'added on top';
      return { what: `Gave Premium, ${length} (${mode})`, who: scope };
    }
    case 'end':
      return { what: 'Ended free Premium', who: scope };
    case 'offer': {
      const after = (row.details as { after?: OfferSnapshot } | null)?.after;
      const what = !after
        ? 'Changed the welcome offer'
        : after.enabled
          ? `Welcome offer on, ${after.days} days${after.autoOffAt ? `, off ${formatDay(after.autoOffAt)}` : ''}`
          : 'Welcome offer off';
      return { what, who: 'New signups' };
    }
    default:
      return { what: 'Undid an earlier action', who: scope };
  }
}

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-4 text-muted-foreground text-sm">
        Nothing yet. Every give, end, offer change and undo shows up here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">What</th>
            <th className="px-4 py-2 font-medium">Who</th>
            <th className="px-4 py-2 font-medium">Reason</th>
            <th className="px-4 py-2 font-medium">By</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { what, who } = describe(row);
            return (
              <tr key={row.id} className="border-t align-top">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                  {formatDayTime(row.createdAt)}
                </td>
                <td className="px-4 py-2.5">{what}</td>
                <td className="px-4 py-2.5">{who}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {row.reason ?? '—'}
                </td>
                <td className="px-4 py-2.5">{row.adminEmail}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.undoneAt ? (
                    <span className="text-muted-foreground text-xs">
                      Undone {formatDay(row.undoneAt)}
                    </span>
                  ) : row.action !== 'undo' ? (
                    <UndoButton actionId={row.id} />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
