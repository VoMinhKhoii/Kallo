import {
  Activity,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  Users2,
  UtensilsCrossed,
} from 'lucide-react';

export interface NavItemConfig {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    labelKey: 'dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'nutrition',
    href: '/nutrition',
    labelKey: 'nutrition',
    icon: Activity,
  },
  {
    id: 'logging',
    href: '/logging',
    labelKey: 'logging',
    icon: UtensilsCrossed,
  },
  {
    id: 'groups',
    href: '/groups',
    labelKey: 'groups',
    icon: Users2,
  },
  {
    id: 'admin',
    href: '/admin',
    labelKey: 'admin',
    icon: ShieldCheck,
    adminOnly: true,
  },
] as const;

export function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function visibleNavItems(isAdmin: boolean): readonly NavItemConfig[] {
  if (isAdmin) return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => !item.adminOnly);
}
