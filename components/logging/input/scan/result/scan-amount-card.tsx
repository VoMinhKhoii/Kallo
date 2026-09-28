'use client';

import { Check, ChevronsUpDown, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ScanPortion } from '@/lib/domain/scan/amount';

/** One portion a result can be logged by: "Serving", "Pack", "Custom". */
export interface ScanPortionChoice {
  value: ScanPortion;
  /** The menu row ("Serving"). */
  label: string;
  /** What the Portion row shows once chosen ("100 ml / serving"). */
  display: string;
  /** The menu row's muted size ("100 ml"). */
  detail?: string;
}

const STEP =
  'flex size-8 items-center justify-center rounded-full bg-kallo-segment text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-40';

/**
 * The result's amount card — the Flutter app's `ScanAmountCard`: Portion (a
 * pull-down, checked on the current choice), Amount (− value +) and, for a
 * drink's custom amount, the cups under them. Every row reads the same way:
 * what it is on the left, its value and control on the right.
 */
export function ScanAmountCard({
  choices,
  selected,
  onSelect,
  amount,
  canDecrease,
  canIncrease,
  onStep,
  cups,
  disabled,
}: {
  choices: ScanPortionChoice[];
  selected: ScanPortion;
  onSelect: (portion: ScanPortion) => void;
  /** The Amount row's value: "1 serving", or the typed custom amount. */
  amount: ReactNode;
  canDecrease: boolean;
  canIncrease: boolean;
  onStep: (direction: 1 | -1) => void;
  cups?: ReactNode;
  disabled: boolean;
}) {
  const t = useTranslations('logging.scan');
  const current =
    choices.find((choice) => choice.value === selected) ?? choices[0];
  const menu = choices.length > 1 && !disabled;
  return (
    <section className="mt-4 overflow-hidden rounded-[22px] bg-white">
      <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
        <span className="text-[16px] text-kallo-text">{t('portion')}</span>
        {menu ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('portion')}
              className="flex items-center gap-1 text-[16px] text-kallo-text outline-none"
            >
              {current.display}
              <ChevronsUpDown className="size-4 text-kallo-text-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56 rounded-2xl">
              {choices.map((choice) => (
                <DropdownMenuItem
                  key={choice.value}
                  onSelect={() => {
                    if (choice.value !== selected) onSelect(choice.value);
                  }}
                  className="gap-3 py-2.5 text-[16px]"
                >
                  <Check
                    className={
                      choice.value === selected ? 'size-4' : 'size-4 opacity-0'
                    }
                  />
                  <span className="flex-1">{choice.label}</span>
                  {choice.detail && (
                    <span className="text-[14px] text-kallo-text-muted">
                      {choice.detail}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-[16px] text-kallo-text">{current.display}</span>
        )}
      </div>
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-kallo-border border-t px-4">
        <span className="text-[16px] text-kallo-text">{t('amount')}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t('decrease')}
            disabled={disabled || !canDecrease}
            onClick={() => onStep(-1)}
            className={STEP}
          >
            <Minus className="size-4" />
          </button>
          <div className="min-w-16 text-center">{amount}</div>
          <button
            type="button"
            aria-label={t('increase')}
            disabled={disabled || !canIncrease}
            onClick={() => onStep(1)}
            className={STEP}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      {cups && <div className="px-4 pt-2 pb-3">{cups}</div>}
    </section>
  );
}
