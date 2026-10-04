import { GrantForm } from '@/components/admin/premium/grant-form';
import { RecentGrantsTable } from '@/components/admin/premium/recent-grants-table';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import { listRecentGrants } from '@/lib/admin/premium/recent-grants';
import { db } from '@/lib/infra/db/client';

export const metadata = { title: 'Premium' };

export default async function AdminPremiumPage() {
  await requireAdmin();
  const grants = await listRecentGrants(db);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-bold text-2xl">Grant Premium</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Complimentary Premium starting now. An account keeps whichever of its
          grants runs longest, so this never shortens a paid subscription.
        </p>
      </div>
      <GrantForm />
      <RecentGrantsTable grants={grants} />
    </div>
  );
}
