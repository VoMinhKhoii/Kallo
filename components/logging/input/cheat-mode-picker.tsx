'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CheatIntensity } from '@/lib/types/cheat';

const INTENSITIES: CheatIntensity[] = ['light', 'medium', 'heavy'];

interface CheatModePickerProps {
  isCheat: boolean;
  intensity: CheatIntensity;
  disabled?: boolean;
  onChangeMode: (isCheat: boolean) => void;
  onChangeIntensity: (intensity: CheatIntensity) => void;
}

/**
 * Compact mode picker that sits beside the send button (an AI-model-picker
 * pattern). Normal vs Cheat meal; in cheat mode a light/medium/heavy intensity
 * (like a "thinking" level) that scales the slider estimate.
 */
export function CheatModePicker({
  isCheat,
  intensity,
  disabled,
  onChangeMode,
  onChangeIntensity,
}: CheatModePickerProps) {
  const t = useTranslations('logging');

  const triggerLabel = isCheat
    ? `${t('mode.cheat')} · ${t(`cheatIntensity.${intensity}`)}`
    : t('mode.normal');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        disabled={disabled}
        aria-label={t('modePicker.ariaLabel')}
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 font-medium text-nham-text text-xs transition-colors hover:bg-nham-hover/50 disabled:opacity-50"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        <span className="max-w-[8rem] truncate">{triggerLabel}</span>
        <ChevronDown className="h-3 w-3 text-nham-text-muted/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-nham-border/60"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {/* Mode: Normal vs Cheat — a model-picker pattern with a one-line
            description each and a brown tick on the selected row. */}
        {(
          [
            { isCheat: false, key: 'normal' },
            { isCheat: true, key: 'cheat' },
          ] as const
        ).map((mode) => {
          const selected = isCheat === mode.isCheat;
          return (
            <DropdownMenuItem
              key={mode.key}
              // Keep the menu open so the cheat intensity reveals in place.
              onSelect={(event) => {
                event.preventDefault();
                onChangeMode(mode.isCheat);
              }}
              className="items-start gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-nham-text text-sm">
                  {t(`mode.${mode.key}`)}
                </span>
                <span className="mt-0.5 block text-[11px] text-nham-text-muted leading-snug">
                  {t(`mode.${mode.key}Description`)}
                </span>
              </span>
              {selected && (
                <Check className="mt-0.5 size-4 shrink-0 text-nham-accent" />
              )}
            </DropdownMenuItem>
          );
        })}

        {isCheat && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="pb-0 text-nham-text-muted text-xs">
              {t('cheatIntensity.label')}
            </DropdownMenuLabel>
            <p className="px-2 pb-1 text-[11px] text-nham-text-muted/70">
              {t('cheatIntensity.helper')}
            </p>
            {INTENSITIES.map((level) => {
              const selected = intensity === level;
              return (
                <DropdownMenuItem
                  key={level}
                  onSelect={() => onChangeIntensity(level)}
                  className="justify-between"
                >
                  <span className="text-sm">
                    {t(`cheatIntensity.${level}`)}
                  </span>
                  {selected && (
                    <Check className="size-4 shrink-0 text-nham-accent" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
