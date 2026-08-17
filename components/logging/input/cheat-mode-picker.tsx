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
import type { CheatIntensity } from '@/lib/core/types/cheat';

export type InputMode = 'normal' | 'manual' | 'cheat';

const INTENSITIES: CheatIntensity[] = ['light', 'medium', 'heavy'];
const MODES: InputMode[] = ['normal', 'manual', 'cheat'];

interface CheatModePickerProps {
  mode: InputMode;
  intensity: CheatIntensity;
  disabled?: boolean;
  onChangeMode: (mode: InputMode) => void;
  onChangeIntensity: (intensity: CheatIntensity) => void;
}

/**
 * Compact mode picker that sits beside the send button (an AI-model-picker
 * pattern). Normal / Manual / Cheat meal; in cheat mode a light/medium/heavy
 * intensity (like a "thinking" level) that scales the slider estimate.
 */
export function CheatModePicker({
  mode,
  intensity,
  disabled,
  onChangeMode,
  onChangeIntensity,
}: CheatModePickerProps) {
  const t = useTranslations('logging');

  const triggerLabel =
    mode === 'cheat'
      ? `${t('mode.cheat')} · ${t(`cheatIntensity.${intensity}`)}`
      : mode === 'manual'
        ? t('mode.manual')
        : t('mode.normal');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        disabled={disabled}
        aria-label={t('modePicker.ariaLabel')}
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 font-medium font-sans-display text-kallo-text text-xs transition-colors hover:bg-kallo-hover/50 disabled:opacity-50"
      >
        <span className="max-w-[8rem] truncate">{triggerLabel}</span>
        <ChevronDown className="h-3 w-3 text-kallo-text-muted/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-kallo-border/60 font-sans-display"
      >
        {MODES.map((m) => {
          const selected = mode === m;
          return (
            <DropdownMenuItem
              key={m}
              onSelect={(event) => {
                event.preventDefault();
                onChangeMode(m);
              }}
              className="items-start gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-kallo-text text-sm">
                  {t(`mode.${m}`)}
                </span>
                <span className="mt-0.5 block text-[11px] text-kallo-text-muted leading-snug">
                  {t(`mode.${m}Description`)}
                </span>
              </span>
              {selected && (
                <Check className="mt-0.5 size-4 shrink-0 text-kallo-text" />
              )}
            </DropdownMenuItem>
          );
        })}

        {mode === 'cheat' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="pb-0 text-kallo-text-muted text-xs">
              {t('cheatIntensity.label')}
            </DropdownMenuLabel>
            <p className="px-2 pb-1 text-[11px] text-kallo-text-muted/70">
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
                    <Check className="size-4 shrink-0 text-kallo-text" />
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
