'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { KalloMark } from '@/components/brand/kallo-mark';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { cn } from '@/lib/utils';
import { SidebarTooltip } from './sidebar-tooltip';

interface SidebarBrandHeaderProps {
  collapsed: boolean;
  pinnedCollapsed: boolean;
  onTogglePinned: () => void;
}

/**
 * Desktop sidebar header — brand + pin/unpin toggle. Expanded: wordmark left,
 * close toggle right. Collapsed: one button that IS the K mark and morphs
 * into the expand icon on hover/focus.
 */
export function SidebarBrandHeader({
  collapsed,
  pinnedCollapsed,
  onTogglePinned,
}: SidebarBrandHeaderProps) {
  const t = useTranslations('app.mainSidebar');

  return (
    <div
      className={cn(
        'flex shrink-0 items-center px-3 pt-3',
        collapsed ? 'justify-center' : 'justify-between'
      )}
    >
      {!collapsed && (
        <KalloWordmark className="ml-1.5 h-4 w-auto text-nham-text" />
      )}
      <SidebarTooltip
        enabled={collapsed}
        label={pinnedCollapsed ? t('expandSidebar') : t('collapseSidebar')}
      >
        <button
          type="button"
          onClick={onTogglePinned}
          aria-label={
            pinnedCollapsed ? t('expandSidebar') : t('collapseSidebar')
          }
          aria-pressed={pinnedCollapsed}
          aria-keyshortcuts="Meta+B Control+B"
          className={cn(
            'group/toggle relative flex items-center justify-center rounded-md text-nham-text-muted transition-colors hover:bg-nham-hover/60 hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent',
            collapsed ? 'h-8 w-8' : 'h-7 w-7'
          )}
        >
          {collapsed ? (
            <>
              <KalloMark className="h-5 w-auto text-nham-text transition-opacity duration-150 group-hover/toggle:opacity-0 group-focus-visible/toggle:opacity-0" />
              <PanelLeftOpen className="absolute h-4 w-4 opacity-0 transition-opacity duration-150 group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100" />
            </>
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </SidebarTooltip>
    </div>
  );
}
