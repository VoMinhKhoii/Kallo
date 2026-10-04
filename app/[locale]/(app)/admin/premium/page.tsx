import { ActivityTable } from '@/components/admin/premium/activity/activity-table';
import { OfferForm } from '@/components/admin/premium/overview/offer-form';
import { formatDay } from '@/components/admin/premium/shared/format';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import {
  getOverview,
  listEndingSoon,
} from '@/lib/admin/premium/accounts/overview';
import { listActivity } from '@/lib/admin/premium/activity/list-activity';
import { getWelcomeOffer } from '@/lib/admin/premium/offer/offer';
import { db } from '@/lib/infra/db/client';

export default async function PremiumOverviewPage() {
  await requireAdmin();
  const [overview, offer, endingSoon, recent] = await Promise.all([
    getOverview(db),
    getWelcomeOffer(db),
    listEndingSoon(db),
    listActivity(db, { limit: 5 }),
  ]);

  const stats = [
    { label: 'On free Premium now', value: overview.onFreePremium },
    { label: 'Ending in the next 3 days', value: overview.endingSoon },
    { label: 'Paying', value: overview.paying },
    {
      label: 'Upgraded during free Premium',
      value: overview.upgradedDuringFree,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <p className="text-muted-foreground text-xs">{stat.label}</p>
            <p className="mt-1 font-semibold text-2xl tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <OfferForm
        saved={{
          enabled: offer.enabled,
          days: String(offer.days),
          autoOffOn: offer.autoOffAt?.toISOString().slice(0, 10) ?? '',
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold text-base">Ending soon</h2>
          {endingSoon.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nobody's free Premium ends soon.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {endingSoon.map((account) => (
                <li key={account.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {account.email}
                  </span>
                  <span className="tabular-nums">
                    {formatDay(account.freeUntil)}
                  </span>
                  <Link
                    href={`/admin/premium/accounts/${account.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    Extend
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold text-base">Recent activity</h2>
            <Link
              href="/admin/premium/activity"
              className="text-sm underline-offset-4 hover:underline"
            >
              All activity
            </Link>
          </div>
          <ActivityTable rows={recent} />
        </section>
      </div>
    </div>
  );
}
