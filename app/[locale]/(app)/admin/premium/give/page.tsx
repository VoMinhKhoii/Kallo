import { GiveForm } from '@/components/admin/premium/give/give-form';
import { requireAdmin } from '@/lib/admin/authz/require-admin';

export default async function PremiumGivePage() {
  await requireAdmin();
  return <GiveForm />;
}
