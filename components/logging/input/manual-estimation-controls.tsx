'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import {
  type ManualItem,
  type ManualLoggingFormState,
  type MealContext,
} from '@/lib/logging/manual-estimation';
import { cn } from '@/lib/utils';

interface ManualEstimationControlsProps {
  disabled?: boolean;
  state: ManualLoggingFormState;
  onMealContextChange: (value: MealContext | null) => void;
  onItemChange: (id: string, field: 'qty' | 'name', value: string) => void;
  onItemAdd: (afterId?: string) => string;
  onItemRemove: (id: string) => void;
}

interface ChoiceChipProps {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

function ChoiceChip({ active, disabled, label, onClick }: ChoiceChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/40 focus-visible:ring-offset-2',
        active
          ? 'border-nham-btn bg-nham-btn text-white'
          : 'border-nham-border/60 bg-white text-nham-text hover:border-nham-accent/50 hover:bg-nham-hover/30',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {label}
    </button>
  );
}

type ItemRefs = { qty: HTMLInputElement | null; name: HTMLInputElement | null };

export function ManualEstimationControls({
  disabled,
  state,
  onMealContextChange,
  onItemChange,
  onItemAdd,
  onItemRemove,
}: ManualEstimationControlsProps) {
  const t = useTranslations('logging');
  const inputRefs = useRef(new Map<string, ItemRefs>());
  const pendingFocus = useRef<{ id: string; field: 'qty' | 'name' } | null>(
    null
  );

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    inputRefs.current.get(target.id)?.[target.field]?.focus();
  });

  const getRefs = (id: string): ItemRefs => {
    if (!inputRefs.current.has(id)) {
      inputRefs.current.set(id, { qty: null, name: null });
    }
    return inputRefs.current.get(id)!;
  };

  const handleQtyKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
    idx: number
  ) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      inputRefs.current.get(id)?.name?.focus();
      return;
    }
    if (e.key === 'Tab' && e.shiftKey && idx > 0) {
      e.preventDefault();
      inputRefs.current.get(state.items[idx - 1].id)?.name?.focus();
      return;
    }
    if (
      e.key === 'Backspace' &&
      e.currentTarget.value === '' &&
      state.items.length > 1
    ) {
      e.preventDefault();
      const prevId = idx > 0 ? state.items[idx - 1].id : undefined;
      if (prevId) pendingFocus.current = { id: prevId, field: 'name' };
      onItemRemove(id);
    }
  };

  const handleNameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
    idx: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pendingFocus.current = { id: onItemAdd(id), field: 'qty' };
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const next = state.items[idx + 1];
      if (next) {
        inputRefs.current.get(next.id)?.qty?.focus();
      } else {
        pendingFocus.current = { id: onItemAdd(id), field: 'qty' };
      }
      return;
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      inputRefs.current.get(id)?.qty?.focus();
    }
  };

  const summary = state.mealContext
    ? t('manualLogging.summary.withContext', {
        context: t(`manualLogging.contextSummary.${state.mealContext}`),
      })
    : t('manualLogging.summary.noContext');

  const fieldClass =
    'rounded-xl border border-nham-border/50 bg-nham-hover/10 px-3 py-2 text-sm text-nham-text placeholder:text-nham-text-muted/40 transition-colors focus:border-nham-accent/50 focus:outline-none disabled:opacity-50';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {state.items.map((item: ManualItem, idx: number) => {
          const refs = getRefs(item.id);
          return (
            <div key={item.id} className="flex items-center gap-2">
              <input
                ref={(el) => {
                  refs.qty = el;
                }}
                type="text"
                value={item.qty}
                onChange={(e) => onItemChange(item.id, 'qty', e.target.value)}
                onKeyDown={(e) => handleQtyKeyDown(e, item.id, idx)}
                placeholder={t('manualLogging.qtyPlaceholder')}
                disabled={disabled}
                className={cn(fieldClass, 'w-[82px] shrink-0')}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
              <input
                ref={(el) => {
                  refs.name = el;
                }}
                type="text"
                value={item.name}
                onChange={(e) => onItemChange(item.id, 'name', e.target.value)}
                onKeyDown={(e) => handleNameKeyDown(e, item.id, idx)}
                placeholder={t('manualLogging.namePlaceholder')}
                disabled={disabled}
                className={cn(fieldClass, 'flex-1')}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const prevId = idx > 0 ? state.items[idx - 1].id : undefined;
                  if (prevId)
                    pendingFocus.current = { id: prevId, field: 'name' };
                  onItemRemove(item.id);
                }}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-nham-text-muted/40 transition-colors',
                  'hover:bg-nham-hover/30 hover:text-nham-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/40',
                  state.items.length <= 1 && 'invisible'
                )}
                aria-label={t('manualLogging.removeItem')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const lastId = state.items[state.items.length - 1]?.id;
            pendingFocus.current = { id: onItemAdd(lastId), field: 'qty' };
          }}
          className="flex items-center gap-1.5 px-1 py-1 text-nham-text-muted/60 text-sm transition-colors hover:text-nham-text-muted disabled:opacity-40 focus-visible:outline-none"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('manualLogging.addItem')}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-nham-border/30 pt-2.5">
        <div className="flex flex-wrap gap-2">
          {(
            ['home_cooked', 'restaurant', 'packaged', 'shared_buffet'] as const
          ).map((value) => (
            <ChoiceChip
              key={value}
              active={state.mealContext === value}
              disabled={disabled}
              label={t(`manualLogging.context.${value}`)}
              onClick={() =>
                onMealContextChange(
                  state.mealContext === value ? null : value
                )
              }
            />
          ))}
        </div>
        <p
          className="text-nham-text-muted text-sm"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {summary}
        </p>
      </div>
    </div>
  );
}
