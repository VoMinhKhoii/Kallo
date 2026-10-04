'use client';

import { Slot } from '@radix-ui/react-slot';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { cn } from '@/lib/core/ui/cn';
import { ResponsiveSheet } from './responsive-sheet';
import { ResponsiveSheetHeader } from './responsive-sheet-header';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The control that opens the modal; omit when `open` is driven elsewhere. */
  trigger?: ReactNode;
  title: string;
  /** One muted line under the title (e.g. the meal being shared). */
  subtitle?: string;
  /** Desktop `DialogContent` classes — the dialog keeps its own anatomy. */
  dialogClassName?: string;
  /** Desktop `DialogHeader` classes. */
  dialogHeaderClassName?: string;
  /** Padding around `children` in the phone sheet, when the body brings none
   *  of its own. */
  sheetBodyClassName?: string;
  children: ReactNode;
}

/**
 * A desktop dialog that becomes a bottom sheet on phones.
 *
 * `ResponsiveSheet` is one surface at every width; this is for the dialogs
 * whose desktop form is established (the serif title, the corner ×) and should
 * stay, but which read as a web pop-up on a phone. Below `md` the same body
 * rises from the bottom edge under the Flutter sheet header (round close on
 * the left, centred title), the way the app's own sheets do.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  trigger,
  title,
  subtitle,
  dialogClassName,
  dialogHeaderClassName,
  sheetBodyClassName,
  children,
}: ResponsiveModalProps) {
  const t = useTranslations('common');
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {trigger ? (
          <Slot aria-haspopup="dialog" onClick={() => onOpenChange(true)}>
            {trigger}
          </Slot>
        ) : null}
        <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title}>
          <ResponsiveSheetHeader
            title={title}
            closeLabel={t('close')}
            onClose={() => onOpenChange(false)}
          />
          {subtitle ? (
            <p className="-mt-2 truncate px-4 pb-2 text-center text-[13px] text-kallo-text-muted">
              {subtitle}
            </p>
          ) : null}
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]',
              sheetBodyClassName
            )}
          >
            {children}
          </div>
        </ResponsiveSheet>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent aria-describedby={undefined} className={dialogClassName}>
        <DialogHeader className={dialogHeaderClassName}>
          <DialogTitle className="font-serif text-[22px] text-kallo-text">
            {title}
          </DialogTitle>
          {subtitle ? (
            // Clears the close button, which the primitive pins at `right-4`.
            <p className="truncate pr-[26px] font-sans-display text-[13px] text-kallo-text-muted">
              {subtitle}
            </p>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
