import { AccountFinder } from '@/components/admin/premium/accounts/account-finder';
import { requireAdmin } from '@/lib/admin/authz/require-admin';

export default async function PremiumAccountsPage() {
  await requireAdmin();
  return <AccountFinder />;
}
