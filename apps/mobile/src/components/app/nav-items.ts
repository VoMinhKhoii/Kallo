import {
  Activity,
  LayoutDashboard,
  type LucideIcon,
  UtensilsCrossed,
} from 'lucide-react-native';

/** Mobile nav items — ported from the web components/app/nav-items.ts (admin
 * excluded per the port scope). Labels resolve under the `app.mainSidebar`
 * namespace, matching the web sidebar. Order matches the web. */
export interface NavItemConfig {
  id: string;
  href: '/dashboard' | '/nutrition' | '/logging';
  labelKey: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItemConfig[] = [
  { id: 'dashboard', href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'nutrition', href: '/nutrition', labelKey: 'nutrition', icon: Activity },
  { id: 'logging', href: '/logging', labelKey: 'logging', icon: UtensilsCrossed },
] as const;

export function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
