'use client';

import type * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Wrapper used by the desktop sidebar to show a brand-styled tooltip when
 * the rail is collapsed. When `enabled` is false (sidebar expanded or
 * peeking), the children render bare so we avoid any tooltip overhead and
 * stale Radix portals.
 */
export function SidebarTooltip({
  enabled,
  label,
  children,
  delayMs = 200,
}: {
  enabled: boolean;
  label: string;
  children: React.ReactNode;
  delayMs?: number;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={delayMs}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={10}
          className="border border-nham-border/60 bg-nham-text font-medium font-sans-display text-[11px] text-nham-surface tracking-tight"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
