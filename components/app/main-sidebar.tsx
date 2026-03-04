'use client';

import {
  Activity,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5 shrink-0" />,
  },
  {
    id: 'tracking',
    label: 'Tracking',
    href: '/tracking',
    icon: <Activity className="h-5 w-5 shrink-0" />,
  },
  {
    id: 'logging',
    label: 'Logging',
    href: '/logging',
    icon: <UtensilsCrossed className="h-5 w-5 shrink-0" />,
  },
];

function SectionHeader({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  return (
    <div className="relative flex h-5 items-center px-3">
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap font-medium text-[10px] text-muted-foreground uppercase tracking-[0.04em] transition-all duration-300',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'
        )}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {label}
      </span>
      <div
        className={cn(
          'absolute inset-x-1 top-1/2 h-px bg-gradient-to-r from-transparent via-[#E8D5B5]/60 to-transparent transition-opacity duration-300',
          collapsed ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}

export function MainSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <aside
      className="flex h-full shrink-0 flex-col gap-6 rounded-xl border border-border/80 bg-white p-3 transition-all duration-300"
      aria-label="Main navigation"
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#F0EAE0]/60 hover:text-[#2C2416]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex flex-col gap-4">
        <SectionHeader label="Main" collapsed={collapsed} />
        <ul className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 transition-all duration-200',
                    isActive
                      ? 'bg-[#695e4e] text-white shadow-[#695e4e]/20 shadow-sm'
                      : 'text-muted-foreground hover:bg-[#F0EAE0]/60 hover:text-[#2C2416]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon}
                  <span
                    className={cn(
                      'overflow-hidden whitespace-nowrap font-medium text-sm tracking-tight transition-all duration-300',
                      collapsed
                        ? 'ml-0 max-w-0 opacity-0'
                        : 'ml-3 max-w-40 opacity-100'
                    )}
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#E8D5B5]/60 to-transparent" />

      {/* Settings */}
      <div className="flex flex-1 flex-col gap-2">
        <SectionHeader label="Settings" collapsed={collapsed} />
        <Link
          href="/settings"
          title={collapsed ? 'Cài đặt' : undefined}
          className={cn(
            'flex items-center rounded-lg px-3 py-2.5 transition-all duration-200',
            pathname === '/settings'
              ? 'bg-[#695e4e] text-white shadow-[#695e4e]/20 shadow-sm'
              : 'text-muted-foreground hover:bg-[#F0EAE0]/60 hover:text-[#2C2416]'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap font-medium text-sm tracking-tight transition-all duration-300',
              collapsed
                ? 'ml-0 max-w-0 opacity-0'
                : 'ml-3 max-w-40 opacity-100'
            )}
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cài đặt
          </span>
        </Link>
      </div>

      {/* User Profile */}
      <div className="flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-[#F0EAE0]/40">
        <div className="flex items-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A87C]/30 to-[#E8D5B5]/50 ring-1 ring-[#C9A87C]/20">
            <span
              className="font-bold text-[#695e4e] text-xs"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              V
            </span>
          </div>
          <div
            className={cn(
              'flex flex-col gap-0.5 overflow-hidden transition-all duration-300',
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-3 max-w-44 opacity-100'
            )}
          >
            <span
              className="whitespace-nowrap font-medium text-[10px] text-muted-foreground uppercase tracking-[0.04em]"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              VMKHOIII
            </span>
            <span
              className="whitespace-nowrap font-medium text-foreground text-xs"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              minhkhoitdn@gmail.com
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#F0EAE0]/60 hover:text-red-500',
            collapsed ? 'hidden' : ''
          )}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
