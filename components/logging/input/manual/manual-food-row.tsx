'use client';

import { Check, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ManualSubtitle } from '@/lib/domain/logging/manual-display';

/** "Raw" / "Cooked", capitalised — it leads its line. */
export function useStateWord() {
  const t = useTranslations('logging.manualLogging');
  return (state: 'raw' | 'cooked') =>
    state === 'cooked' ? t('stateCooked') : t('stateRaw');
}

/** The line under a food's name: the state (or brand) in ink, then " · " and
 *  the rest muted. One run of text, so a long English name wraps under the
 *  subtitle's own left edge and both lines share one two-line clamp. */
export function ManualSubtitleLine({ subtitle }: { subtitle: ManualSubtitle }) {
  const { lead, rest } = subtitle;
  if (!lead && !rest) return null;
  return (
    <p className="mt-0.5 line-clamp-2 text-[14px] text-kallo-text-muted leading-[1.25] tracking-[-0.1px]">
      {lead && <span className="text-kallo-text">{lead}</span>}
      {lead && rest && ' · '}
      {rest}
    </p>
  );
}

/**
 * One food in either manual sheet (approved canvas, G2): its Vietnamese name
 * over the state/English subtitle, calories and a chevron — or the added check
 * — on the right, centred on the WHOLE row so a two-line name never leaves the
 * number hanging off its first line. Rows keep one padding and let their
 * height follow the text. Mirrors the Flutter app's `ManualFoodRow`.
 */
export function ManualFoodRow({
  name,
  subtitle,
  kcal,
  quietKcal = false,
  nameLines = 2,
  added = false,
  addedLabel,
  label,
  onClick,
}: {
  name: string;
  subtitle: ManualSubtitle;
  /** The figure, already formatted ("120"). */
  kcal: string;
  /** One quiet ink line ("180 kcal", the meal's own calories) instead of a
   *  figure with a muted unit (a density per 100 g). */
  quietKcal?: boolean;
  nameLines?: 1 | 2;
  added?: boolean;
  addedLabel?: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-5 py-3 text-left transition-colors hover:bg-kallo-hover/40 active:bg-kallo-hover disabled:hover:bg-transparent"
    >
      <span className="min-w-0 flex-1">
        <span
          className={
            nameLines === 1
              ? 'block truncate text-[16px] text-kallo-text leading-[1.3] tracking-[-0.2px]'
              : 'line-clamp-2 text-[16px] text-kallo-text leading-[1.3] tracking-[-0.2px]'
          }
        >
          {name}
        </span>
        <ManualSubtitleLine subtitle={subtitle} />
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {quietKcal ? (
          <span className="text-[14px] text-kallo-text tabular-nums">
            {kcal} kcal
          </span>
        ) : (
          <span className="whitespace-nowrap text-[16px] text-kallo-text tabular-nums tracking-[-0.2px]">
            {kcal}{' '}
            <span className="text-[14px] text-kallo-text-muted">kcal</span>
          </span>
        )}
        {added ? (
          <Check
            aria-label={addedLabel}
            className="size-[18px] text-kallo-text"
            strokeWidth={1.5}
          />
        ) : (
          <ChevronRight
            aria-hidden
            className="size-[18px] text-kallo-text-muted"
            strokeWidth={1.5}
          />
        )}
      </span>
    </button>
  );
}
