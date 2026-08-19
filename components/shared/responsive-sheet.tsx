'use client';

import type * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { cn } from '@/lib/core/ui/cn';

/**
 * One modal that is a bottom drawer on phones and a centered dialog on wider
 * screens, styled to match the Flutter app's sheets so the same surface reads
 * as the same component on both platforms.
 *
 * Surface tokens are the mobile ones (`KalloSheetSurface` in
 * `apps/mobile-flutter/lib/shared/widgets/sheet/kallo_sheet.dart`): solid
 * `kallo-surface`, 22px corners (`kCardRadius`), `kallo-border` hairlines, and a
 * 90dvh ceiling (`maxHeightFraction` 0.9) so the scrim stays tappable and the
 * modal never reads as a full-screen page.
 *
 * The drawer form is what fixes the real phone problems the centered dialog
 * had: it rises from the bottom edge instead of fighting the on-screen
 * keyboard from the middle of the viewport, and its content can run the full
 * width instead of being pinned to `sm:max-w-md`.
 *
 * `dismissible={false}` locks every exit — Escape, the backdrop, and (on the
 * drawer) the drag handle — which is what a save in flight needs: the request
 * would still complete server-side, silently logging a meal the user never saw
 * confirmed.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  dismissible = true,
  title,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissible?: boolean;
  /** Accessible name. Rendered visually by `ResponsiveSheetHeader`; this is
   * the screen-reader title Radix and vaul both require. */
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const surface = cn(
    'flex flex-col overflow-hidden border-kallo-border bg-kallo-surface font-sans-display text-kallo-text',
    className
  );
  const handleOpenChange = (next: boolean) => {
    if (!next && !dismissible) return;
    onOpenChange(next);
  };

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        dismissible={dismissible}
      >
        <DrawerContent
          aria-describedby={undefined}
          className={cn(
            surface,
            'max-h-[90dvh] rounded-t-[22px] border-t',
            // vaul's own grab handle: the mobile sheet's 36x4 bar, in the
            // same hairline colour.
            '[&>div:first-child]:my-2 [&>div:first-child]:h-1 [&>div:first-child]:w-9 [&>div:first-child]:bg-kallo-border'
          )}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        className={cn(
          surface,
          'max-h-[90dvh] gap-0 rounded-[22px] p-0 sm:max-w-md'
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
