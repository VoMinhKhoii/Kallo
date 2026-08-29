import {
  Activity,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  ShieldCheck,
  Users2,
} from 'lucide-react';

/** The closed set of nav destinations. Naming them as a union lets the badge
 *  hook be keyed by real ids instead of any string. */
export type NavItemId =
  | 'dashboard'
  | 'nutrition'
  | 'logging'
  | 'groups'
  | 'activity'
  | 'admin';

export interface NavItemConfig {
  id: NavItemId;
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
    icon: NotebookPen,
  },
  {
    id: 'groups',
    href: '/circle',
    labelKey: 'groups',
    icon: Users2,
  },
  {
    // Heart, not Lucide's `Activity` — that glyph is the nutrition rail item.
    id: 'activity',
    href: '/activity',
    labelKey: 'activity',
    icon: Heart,
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
