import { healthAggregates } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
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
  if (rate === null) return 'text-nham-text-muted';
  if (rate >= 0.95) return 'text-nham-success';
  if (rate >= 0.8) return 'text-amber-700 dark:text-amber-400';
  return 'text-nham-danger';
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
      colorClass: 'text-nham-text',
    },
    {
      label: 'p95 latency (24 h)',
      value: ms(agg.p95_24h),
      colorClass: 'text-nham-text',
    },
    {
      label: 'p99 latency (24 h)',
      value: ms(agg.p99_24h),
      colorClass: 'text-nham-text',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 font-sans-display">
      <div>
        <h1
          className="font-bold text-2xl text-nham-text tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Pipeline Health
        </h1>
        <p className="mt-1 text-nham-text-muted text-sm">
          Aggregated metrics over the last 30 days. Replays excluded.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            className="rounded-lg border border-nham-border/60 bg-white/50 p-4 dark:bg-white/[0.02]"
            key={card.label}
          >
            <p className="text-nham-text-muted text-xs">{card.label}</p>
            <p
              className={`mt-1 font-bold text-2xl tabular-nums ${card.colorClass}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div className="rounded-lg border border-nham-border/60 bg-white/50 p-5 dark:bg-white/[0.02]">
        <p className="mb-3 font-semibold text-nham-text text-sm">
          Requests per day — last 30 days
        </p>
        <Sparkline data={agg.requestsPerDay30d} />
      </div>

      {/* Top errors */}
      <div className="overflow-hidden rounded-lg border border-nham-border/60 bg-white/50 dark:bg-white/[0.02]">
        <div className="border-nham-border/60 border-b px-5 py-3">
          <h2 className="font-semibold text-nham-text text-sm">
            Top errors — last 30 days
          </h2>
        </div>

        {agg.topErrors30d.length === 0 ? (
          <p className="px-5 py-4 text-nham-text-muted text-sm">
            No errors recorded.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-nham-track/50">
              <tr className="text-nham-text-muted">
                <th className="px-5 py-2 text-left font-medium">Error</th>
                <th className="px-5 py-2 text-right font-medium tabular-nums">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {agg.topErrors30d.map((e) => (
                <tr className="border-nham-border/40 border-t" key={e.error}>
                  <td className="px-5 py-2 font-mono text-nham-text text-xs">
                    {e.error}
                  </td>
                  <td className="px-5 py-2 text-right text-nham-text tabular-nums">
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
