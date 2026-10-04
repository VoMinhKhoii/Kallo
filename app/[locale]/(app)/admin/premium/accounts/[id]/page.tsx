import { notFound } from 'next/navigation';
import { z } from 'zod';
import { GrantsTable } from '@/components/admin/premium/accounts/grants-table';
import { QuickActions } from '@/components/admin/premium/accounts/quick-actions';
import { formatDay } from '@/components/admin/premium/shared/format';
import { PlanBadge } from '@/components/admin/premium/shared/plan-badge';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import { getAccount } from '@/lib/admin/premium/accounts/lookup';
import { db } from '@/lib/infra/db/client';

export default async function PremiumAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const account = await getAccount(db, id);
  if (!account) notFound();

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold text-base">
            {account.name ?? account.email}
          </h2>
          <p className="text-muted-foreground text-xs">
            {account.email} · joined {formatDay(account.joinedAt)}
          </p>
        </div>
        <PlanBadge plan={account.plan} freeUntil={account.freeUntil} />
        <div className="border-t pt-4">
          <QuickActions
            userId={account.id}
            paying={account.plan === 'paying'}
            canEnd={account.plan === 'complimentary'}
          />
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold text-base">Grants</h2>
        <GrantsTable grants={account.grants} />
        <p className="text-muted-foreground text-xs">
          The account keeps whichever grant runs longest. A paid plan always
          wins and can only be managed in the store.
        </p>
      </section>
    </div>
  );
}
