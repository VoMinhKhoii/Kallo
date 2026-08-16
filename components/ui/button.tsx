import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
        // Landing page variants — token-only; colors resolve to the same
        // hexes the previous raw values hardcoded (see --kallo-* in globals.css)
        'landing-primary':
          'rounded-xl bg-kallo-accent text-white shadow-sm hover:bg-kallo-accent-hover !font-medium text-base',
        'landing-secondary':
          'rounded-xl border border-kallo-border text-kallo-text-soft hover:bg-kallo-surface !font-medium text-base',
        'landing-ghost':
          'text-kallo-text-soft text-sm hover:text-kallo-text h-auto p-0 !font-normal',
        // The black landing CTA. `hero-dark` is the same ink but dressed for a
        // button standing on the page — heavy shadow, hover lift, wide
        // tracking. Sitting inside a card or a header bar it needs none of
        // that, and borrowing it meant cancelling three utilities per call.
        'landing-ink':
          'rounded-xl bg-kallo-ink text-kallo-surface hover:bg-kallo-ink-hover !font-medium text-base',
        'hero-dark':
          'rounded-xl bg-kallo-ink text-kallo-surface shadow-lg hover:-translate-y-0.5 hover:bg-kallo-ink-hover hover:shadow-xl !font-medium tracking-wide text-base',
        'hero-outline':
          'rounded-xl border border-kallo-border text-kallo-text-soft hover:-translate-y-0.5 hover:bg-kallo-border/20 !font-medium tracking-wide text-base',
        'header-cta':
          'rounded-lg bg-kallo-accent text-white hover:bg-kallo-accent-hover !font-medium text-sm',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
        // Landing page sizes
        landing: 'px-10 py-4',
        hero: 'px-8 py-4',
        header: 'px-6 py-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
