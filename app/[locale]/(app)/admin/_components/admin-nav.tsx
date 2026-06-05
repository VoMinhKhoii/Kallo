'use client';

import { Activity, Inbox, type LucideIcon, ScrollText } from 'lucide-react';
import { isActiveRoute } from '@/components/app/nav-items';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface AdminNavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LINKS: readonly AdminNavLink[] = [
  { href: '/admin/requests', label: 'Requests', icon: Inbox },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/prompts', label: 'Prompts', icon: ScrollText },
] as const;

/**
 * Persistent admin sub-navigation. Sticks to the top of the admin scroll
 * container so Requests · Health · Prompts are reachable from any admin page
 * without scrolling back up. Mirrors the app sidebar's active-link styling.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-nham-border/60 border-b bg-nham-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-6">
        <span className="shrink-0 font-lora font-semibold text-nham-text text-sm tracking-tight">
          Nhẩm Admin
        </span>
        <nav aria-label="Admin sections" className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium font-sans-display text-[13px] tracking-tight transition-colors',
                  active
                    ? 'bg-nham-btn text-white shadow-nham-btn/20 shadow-sm'
                    : 'text-nham-text-muted hover:bg-nham-hover/60 hover:text-nham-text'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
