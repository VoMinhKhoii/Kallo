import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminSidebar } from './_components/admin-sidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1">
        <header className="flex h-12 items-center justify-between border-b px-4 text-muted-foreground text-sm">
          <span>Admin</span>
          <span>{admin.email}</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
