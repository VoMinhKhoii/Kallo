import {
  Activity,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  Users2,
} from 'lucide-react';

/** The closed set of nav destinations. Naming them as a union lets the badge
 *  hook be keyed by real ids instead of any string. */
export type NavItemId =
  | 'dashboard'
  | 'nutrition'
  | 'logging'
  | 'groups'
  | 'activity';

export interface NavItemConfig {
  id: NavItemId;
  href: string;
  labelKey: string;
  icon: LucideIcon;
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
] as const;

export function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

/** Phone pages that take the whole screen: no tab bar, a back chevron in the
 *  header instead. The logging feed, as Flutter pushes its Log screen over
 *  the tabs — the composer owns the bottom edge there. */
const FULL_SCREEN_ROUTES = ['/logging'] as const;

export function isFullScreenRoute(pathname: string): boolean {
  return FULL_SCREEN_ROUTES.some((href) => isActiveRoute(pathname, href));
}
