import { requireAdmin } from '@/lib/admin/authz/require-admin';

// Deliberately blocking (`instant = false`): an internal, low-traffic area
// whose layout gates on `requireAdmin()` (a session read) before anything
// renders. Navigating INTO /admin may wait on that check; navigations between
// admin pages are still validated and show admin/loading.tsx while the page's
// database reads stream. Replaces `dynamic = 'force-dynamic'`, which Cache
// Components rejects — pages behind a session read are request-time anyway.
export const instant = false;

export const metadata = {
  title: 'Kallo Admin',
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
