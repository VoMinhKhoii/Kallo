import { ActivityTable } from '@/components/admin/premium/activity/activity-table';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import type { AuditAction } from '@/lib/admin/premium/activity/audit';
import { listActivity } from '@/lib/admin/premium/activity/list-activity';
import { cn } from '@/lib/core/ui/cn';
import { db } from '@/lib/infra/db/client';

const FILTERS: { value?: AuditAction; label: string }[] = [
  { label: 'All' },
  { value: 'grant', label: 'Gave' },
  { value: 'end', label: 'Ended' },
  { value: 'offer', label: 'Offer changes' },
  { value: 'undo', label: 'Undos' },
];

export default async function PremiumActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = (await searchParams).action;
  const action = FILTERS.find((f) => f.value && f.value === raw)?.value;
  const rows = await listActivity(db, { action, limit: 100 });

  return (
    <div className="space-y-4">
      <nav aria-label="Filter activity" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={
              filter.value
                ? `/admin/premium/activity?action=${filter.value}`
                : '/admin/premium/activity'
            }
            aria-current={filter.value === action ? 'page' : undefined}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm hover:bg-kallo-hover',
              filter.value === action && 'bg-kallo-hover font-semibold'
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      <section className="rounded-xl border bg-card">
        <ActivityTable rows={rows} />
      </section>
      <p className="text-muted-foreground text-xs">
        Undo reverses exactly what that action did and is itself logged.
      </p>
    </div>
  );
}
