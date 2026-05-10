import { requireAdmin } from '@/lib/admin/require-admin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nhẩm Admin',
  robots: { index: false, follow: false },
};

/**
 * Layout owns the admin page chrome:
 *  - vertical scroll container (the AppShell is viewport-locked, so each
 *    feature must bring its own scroll)
 *  - outer page padding (`p-3 sm:p-6`)
 *
 * Page components under /admin must NOT add their own `p-*`. Width-constraining
 * wrappers (`mx-auto max-w-Xxl`) and inner spacing (`space-y-*`) stay per-page.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 sm:p-6">{children}</div>
    </div>
  );
}
