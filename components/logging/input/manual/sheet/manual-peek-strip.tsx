'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ManualPeek } from '@/lib/domain/logging/manual-display';
import { formatKcal } from '@/lib/domain/logging/manual-logging';

/** How much of the meal sheet's strip shows above the add sheet. */
export const PEEK_HEIGHT = 26;

/**
 * The meal sheet's edge, peeking above the add sheet stacked on it, with the
 * one thing worth knowing while you search: what is already on the plate,
 * and on a food's page what the plate becomes with it. Mirrors the Flutter
 * `ManualPeekStrip`; what it says is `manualPeek`'s.
 */
export function ManualPeekStrip({ peek }: { peek: ManualPeek }) {
  const t = useTranslations('logging.manualLogging');
  const text =
    peek.kind === 'empty'
      ? t('peekEmpty')
      : t('peek', {
          count: t('ingredientCount', { count: peek.count }),
          kcal: formatKcal(peek.kcal),
        });
  const after =
    peek.kind === 'with' || peek.kind === 'after'
      ? t(peek.kind === 'with' ? 'peekWith' : 'peekAfter', {
          kcal: formatKcal(peek.after),
        })
      : null;
  return (
    <div
      aria-hidden
      className="absolute inset-x-3.5 top-0 rounded-t-[30px] bg-[#d9d6ce] px-6 pt-[7px] text-center text-[#55534d] text-[12px] tabular-nums leading-[15px]"
      style={{ height: PEEK_HEIGHT + 34 }}
    >
      <span className="inline-flex max-w-full items-center gap-1 truncate">
        {text}
        {after && (
          <>
            <ArrowRight className="size-3 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{after}</span>
          </>
        )}
      </span>
    </div>
  );
}
