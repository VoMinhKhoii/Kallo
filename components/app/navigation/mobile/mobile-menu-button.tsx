import { Menu } from 'lucide-react';
import type { ComponentProps } from 'react';
import { OnboardingDot } from '../onboarding-nudge';

interface MobileMenuButtonProps extends ComponentProps<'button'> {
  open: boolean;
  label: string;
  onboardingIncomplete: boolean;
  inviteCount: number;
}

export function MobileMenuButton({
  open,
  label,
  onboardingIncomplete,
  inviteCount,
  ...triggerProps
}: MobileMenuButtonProps) {
  // Rendered via Radix `SheetTrigger asChild`, which injects its onClick/ref
  // through these props — they MUST reach the real <button>, or the hamburger
  // silently stops opening the drawer.
  return (
    <button
      type="button"
      {...triggerProps}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-md text-nham-text transition-colors hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent group-has-[[data-strip-mode=true]]/mobileheader:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
      {onboardingIncomplete ? (
        <OnboardingDot className="top-1.5 right-1.5" />
      ) : inviteCount > 0 ? (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-nham-accent ring-2 ring-nham-surface" />
      ) : null}
    </button>
  );
}
