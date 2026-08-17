import { requireAdmin } from '@/lib/admin/authz/require-admin';
import { healthAggregates } from '@/lib/admin/queries/health';
import { db } from '@/lib/infra/db';
import { Sparkline } from './_components/sparkline';

export const dynamic = 'force-dynamic';

function pct(rate: number | null) {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function ms(value: number | null) {
  if (value === null) return '—';
  return `${Math.round(value)} ms`;
}

function rateColor(rate: number | null) {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.95) return 'text-green-600 dark:text-green-400';
  if (rate >= 0.8) return 'text-yellow-600 dark:text-yellow-500';
  return 'text-red-600 dark:text-red-400';
}

export default async function HealthPage() {
  await requireAdmin();
  const agg = await healthAggregates(db);

  const statCards = [
    {
      label: 'Success rate (24 h)',
      value: pct(agg.successRate24h),
      colorClass: rateColor(agg.successRate24h),
    },
    {
      label: 'Success rate (7 d)',
      value: pct(agg.successRate7d),
      colorClass: rateColor(agg.successRate7d),
    },
    {
      label: 'Success rate (30 d)',
      value: pct(agg.successRate30d),
      colorClass: rateColor(agg.successRate30d),
    },
    {
      label: 'p50 latency (24 h)',
      value: ms(agg.p50_24h),
      colorClass: 'text-foreground',
    },
    {
      label: 'p95 latency (24 h)',
      value: ms(agg.p95_24h),
      colorClass: 'text-foreground',
    },
    {
      label: 'p99 latency (24 h)',
      value: ms(agg.p99_24h),
      colorClass: 'text-foreground',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-bold text-2xl">Pipeline Health</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Aggregated metrics over the last 30 days. Replays excluded.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-xs">{card.label}</p>
            <p
              className={`mt-1 font-bold text-2xl tabular-nums ${card.colorClass}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div className="rounded-lg border bg-card p-5">
        <p className="mb-3 font-semibold text-sm">
          Requests per day — last 30 days
        </p>
        <Sparkline data={agg.requestsPerDay30d} />
      </div>

      {/* Top errors */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="font-semibold text-sm">Top errors — last 30 days</h2>
        </div>

        {agg.topErrors30d.length === 0 ? (
          <p className="px-5 py-4 text-muted-foreground text-sm">
            No errors recorded.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Error</th>
                <th className="px-5 py-2 text-right font-semibold tabular-nums">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {agg.topErrors30d.map((e) => (
                <tr key={e.error} className="border-t">
                  <td className="px-5 py-2 font-mono text-xs">{e.error}</td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {e.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
