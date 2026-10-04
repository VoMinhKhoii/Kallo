'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';

const TABS = [
  { href: '/admin/premium', label: 'Overview' },
  { href: '/admin/premium/give', label: 'Give or end Premium' },
  { href: '/admin/premium/accounts', label: 'Look up an account' },
  { href: '/admin/premium/activity', label: 'Activity' },
];

export function PremiumTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Premium admin" className="flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin/premium'
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-muted-foreground text-sm hover:bg-kallo-hover',
              active && 'bg-kallo-hover font-semibold text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
