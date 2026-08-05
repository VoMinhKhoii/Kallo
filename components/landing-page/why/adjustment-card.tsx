'use client';

import { useTranslations } from 'next-intl';

/**
 * One demonstration: a sentence somebody would actually type, and the one
 * thing it changes about the estimate.
 *
 * Deliberately text-only, and deliberately two lines. The argument is that a
 * sentence carries what a picture cannot, so illustrating it with pictures
 * would undercut it — and explaining it at length would bury it.
 */
export function AdjustmentCard({ id }: { id: string }) {
  const t = useTranslations(`landing.why.adjustments.${id}`);

  return (
    <div className="flex flex-col rounded-2xl border border-nham-border/60 bg-white p-5 shadow-sm">
      <p className="font-serif text-[17px] text-nham-text leading-relaxed">
        {t('input')}
      </p>
      <p className="mt-3 font-sans-display text-[13px] text-nham-text-muted">
        {t('effect')}
      </p>
    </div>
  );
}
