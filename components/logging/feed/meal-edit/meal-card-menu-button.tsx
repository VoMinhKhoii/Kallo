'use client';

import { Ellipsis, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionIconButton } from '@/components/logging/feed/action-bar/action-icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/core/ui/cn';

export interface MealCardMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** The menu's row style, shared with the card's right-click menu. */
export const MEAL_MENU_ITEM =
  'gap-2.5 rounded-lg px-2.5 py-2 font-sans-display text-[13px] text-kallo-text focus:bg-kallo-hover/60';
export const MEAL_MENU_DANGER = 'text-kallo-error focus:text-kallo-error';
export const MEAL_MENU_CONTENT =
  'min-w-[180px] rounded-xl border-kallo-border/60 bg-card p-1.5 shadow-kallo-text/[0.08] shadow-lg';

/**
 * The ⋯ at the end of a meal card's action row: Edit and Remove (Discard on an
 * unsaved card). The same items as the card's right-click menu, for a pointer
 * that does not right-click and a reader who looks for a button.
 */
export function MealCardMenuButton({ items }: { items: MealCardMenuItem[] }) {
  const t = useTranslations('logging.mealEdit');
  if (items.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ActionIconButton icon={Ellipsis} label={t('moreOptions')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MEAL_MENU_CONTENT}>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onSelect={item.onSelect}
            className={cn(MEAL_MENU_ITEM, item.danger && MEAL_MENU_DANGER)}
          >
            <span className="flex-1">{item.label}</span>
            <item.icon
              aria-hidden="true"
              className={cn('h-4 w-4', item.danger && 'text-kallo-error')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
