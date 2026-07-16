import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { SidebarTooltip } from '../sidebar-tooltip';

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

interface SidebarNavLinkProps {
  item: SidebarNavItem;
  collapsed: boolean;
  isActive: boolean;
  /** A pending-attention dot (e.g. unaccepted meal-share invites). */
  showBadge?: boolean;
}

export function SidebarNavLink({
  item,
  collapsed,
  isActive,
  showBadge = false,
}: SidebarNavLinkProps) {
  return (
    <SidebarTooltip enabled={collapsed} label={item.label}>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          'group/nav relative flex items-center rounded-lg px-3 py-2 transition-colors duration-200',
          isActive
            ? 'bg-nham-btn text-white shadow-nham-btn/20 shadow-sm'
            : 'text-nham-text-muted hover:bg-nham-hover/60 hover:text-nham-text'
        )}
      >
        <span
          className={cn(
            'relative flex h-5 w-5 shrink-0 items-center justify-center transition-colors',
            collapsed ? 'mx-auto' : ''
          )}
        >
          {item.icon}
          {showBadge && collapsed && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-nham-accent ring-2 ring-white" />
          )}
        </span>
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap font-medium font-sans-display text-[13px] tracking-tight transition-all duration-300',
            collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-3 max-w-40 opacity-100'
          )}
        >
          {item.label}
        </span>
        {showBadge && !collapsed && (
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-nham-accent" />
        )}
      </Link>
    </SidebarTooltip>
  );
}
