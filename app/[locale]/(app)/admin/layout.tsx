import { requireAdmin } from '@/lib/admin/require-admin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nhẩm Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <div className="space-y-4">{children}</div>;
}
