'use client';

import { Settings } from 'lucide-react';
import { useSettingsLink } from '@/hooks/settings/use-settings-dialog';
import { SidebarNavLink } from './sidebar-nav-link';

/** The rail's Settings entry: opens the settings dialog over the page. */
export function SidebarSettingsLink({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  const { isOpen, href, onClick } = useSettingsLink();

  return (
    <SidebarNavLink
      item={{
        id: 'settings',
        label,
        href,
        icon: <Settings className="h-5 w-5" />,
      }}
      collapsed={collapsed}
      isActive={isOpen}
      onClick={onClick}
    />
  );
}
