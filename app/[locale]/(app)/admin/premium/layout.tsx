import { PremiumTabs } from '@/components/admin/premium/shell/premium-tabs';

export const metadata = { title: 'Premium' };

export default function PremiumAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl">Premium</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Free Premium for launch, promos and support. Paid subscriptions are
          never touched from here.
        </p>
      </div>
      <PremiumTabs />
      {children}
    </div>
  );
}
