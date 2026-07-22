'use client';

import type * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ActionIconButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean;
}

export function ActionIconButton({
  icon: Icon,
  label,
  active = false,
  danger = false,
  className,
  ...props
}: ActionIconButtonProps & React.ComponentPropsWithRef<'button'>) {
  const IconComponent = Icon as React.ComponentType<{ className?: string }>;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={cn(
              'rounded-md text-nham-text-muted/70 hover:bg-nham-hover/40 hover:text-nham-text',
              danger && 'hover:bg-nham-danger/10 hover:text-nham-danger',
              active && 'bg-nham-hover text-nham-text',
              className
            )}
            {...props}
          >
            <IconComponent className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="rounded-md bg-nham-text font-sans-display text-nham-surface text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
