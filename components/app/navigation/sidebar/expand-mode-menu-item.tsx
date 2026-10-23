'use client';

import { MousePointerClick } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { cn } from '@/lib/core/ui/cn';
import type { SidebarExpandMode } from '@/lib/sidebar/types';

/** An account-menu row: 14px text, a muted 16px icon, a soft wash when highlighted. */
export const MENU_ROW =
  'flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-2 text-[14px] text-kallo-text outline-none transition-colors focus:bg-kallo-ink/[0.05] focus:text-kallo-text data-[highlighted]:bg-kallo-ink/[0.05]';
export const MENU_ROW_ICON = 'size-4 shrink-0 text-kallo-text-muted';

/**
 * "Expand on hover" in the account menu, as a row with a switch. Toggling
 * keeps the menu open.
 */
export function ExpandModeMenuItem({
  label,
  mode,
  onModeChange,
}: {
  label: string;
  mode: SidebarExpandMode;
  onModeChange: (mode: SidebarExpandMode) => void;
}) {
  const on = mode === 'hover';
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={on}
      onCheckedChange={(checked) => onModeChange(checked ? 'hover' : 'click')}
      onSelect={(event) => event.preventDefault()}
      className={MENU_ROW}
    >
      <MousePointerClick className={MENU_ROW_ICON} />
      <span className="flex-1">{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          on ? 'bg-kallo-text' : 'bg-kallo-track'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-3 rounded-full bg-card shadow-sm transition-transform',
            on && 'translate-x-3'
          )}
        />
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
}
