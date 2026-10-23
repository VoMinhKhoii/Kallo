'use client';

import type { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/core/ui/cn';
import {
  MEAL_MENU_CONTENT,
  MEAL_MENU_DANGER,
  MEAL_MENU_ITEM,
  type MealCardMenuItem,
} from './meal-card-menu-button';

/**
 * Right-click a meal card — or press and hold it on a touch screen — for the
 * same Edit / Remove menu as its ⋯ button. Radix's context menu handles both
 * gestures and opens at the pointer.
 */
export function MealCardContextMenu({
  items,
  children,
}: {
  items: MealCardMenuItem[];
  children: ReactNode;
}) {
  if (items.length === 0) return <>{children}</>;
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className={MEAL_MENU_CONTENT}>
        {items.map((item) => (
          <ContextMenuItem
            key={item.label}
            onSelect={item.onSelect}
            className={cn(MEAL_MENU_ITEM, item.danger && MEAL_MENU_DANGER)}
          >
            <span className="flex-1">{item.label}</span>
            <item.icon
              aria-hidden="true"
              className={cn('h-4 w-4', item.danger && 'text-kallo-error')}
            />
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
