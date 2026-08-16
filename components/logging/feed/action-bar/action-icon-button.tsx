'use client';

import { Loader2 } from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/ui/cn';

interface ActionIconButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  /** In-flight state — swaps the icon for a spinner (mirrors mobile). */
  pending?: boolean;
  disabled?: boolean;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean;
}

export function ActionIconButton({
  icon: Icon,
  label,
  active = false,
  danger = false,
  pending = false,
  className,
  ...props
}: ActionIconButtonProps & React.ComponentPropsWithRef<'button'>) {
  const IconComponent = Icon as React.ComponentType<{ className?: string }>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={cn(
              'rounded-md text-kallo-text hover:bg-kallo-hover/40',
              danger && 'hover:bg-kallo-danger/10 hover:text-kallo-danger',
              active && 'bg-kallo-hover text-kallo-text',
              className
            )}
            {...props}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <IconComponent className="size-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="rounded-md bg-kallo-text font-sans-display text-kallo-surface text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
