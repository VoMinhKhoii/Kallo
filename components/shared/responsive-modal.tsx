'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode, RefObject } from 'react';
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

/** The one scroller, so the header and a body's footer stay in reach. */
const BODY = 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The control that opens the modal; omit when `open` is driven elsewhere. */
  trigger?: ReactNode;
  /** Close-focus target when there is no `trigger` (see `ResponsiveSheet`). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
  /** One muted line under the title (e.g. the meal being shared). */
  subtitle?: string;
  /** Extra desktop `DialogContent` classes — in practice only its width. */
  dialogClassName?: string;
  /** Padding around `children`, for a body that brings none of its own. */
  bodyClassName?: string;
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
 *
 * It owns the whole anatomy on both forms — the dialog's editorial header,
 * the column layout, the single scrolling body — so a caller describes only
 * its body. The column matters: the primitive's default grid sizes its one
 * auto column to the widest non-wrapping line, which spilled long meal names
 * and `whitespace-nowrap` footers outside the card.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  trigger,
  returnFocusRef,
  title,
  subtitle,
  dialogClassName,
  bodyClassName,
  children,
}: ResponsiveModalProps) {
  const t = useTranslations('common');
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        trigger={trigger}
        returnFocusRef={returnFocusRef}
      >
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
            BODY,
            'pb-[env(safe-area-inset-bottom)]',
            bodyClassName
          )}
        >
          {children}
        </div>
      </ResponsiveSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          'flex max-h-[min(90dvh,44rem)] flex-col gap-0 rounded-2xl border-kallo-border/60 bg-white p-0',
          dialogClassName
        )}
      >
        <DialogHeader className="shrink-0 px-[22px] pt-5">
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
        <div className={cn(BODY, bodyClassName)}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
