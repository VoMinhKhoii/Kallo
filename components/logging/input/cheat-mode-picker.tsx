'use client';

import { ChevronDown, Cookie, Utensils } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-nham-border/60 px-2.5 font-medium text-nham-text text-xs transition-colors hover:border-nham-accent/60 hover:bg-nham-hover/40 disabled:opacity-50"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {isCheat ? (
          <Cookie className="h-3.5 w-3.5 text-nham-accent" />
        ) : (
          <Utensils className="h-3.5 w-3.5 text-nham-text-muted" />
        )}
        <span className="max-w-[8rem] truncate">{triggerLabel}</span>
        <ChevronDown className="h-3 w-3 text-nham-text-muted/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-nham-border/60"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        <DropdownMenuRadioGroup
          value={isCheat ? 'cheat' : 'precise'}
          onValueChange={(value) => onChangeMode(value === 'cheat')}
        >
          <DropdownMenuRadioItem value="precise">
            <Utensils className="h-3.5 w-3.5" />
            {t('mode.normal')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="cheat">
            <Cookie className="h-3.5 w-3.5" />
            {t('mode.cheat')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {isCheat && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="pb-0 text-nham-text-muted text-xs">
              {t('cheatIntensity.label')}
            </DropdownMenuLabel>
            <p className="px-2 pb-1 text-[11px] text-nham-text-muted/70">
              {t('cheatIntensity.helper')}
            </p>
            <DropdownMenuRadioGroup
              value={intensity}
              onValueChange={(value) =>
                onChangeIntensity(value as CheatIntensity)
              }
            >
              {INTENSITIES.map((level) => (
                <DropdownMenuRadioItem key={level} value={level}>
                  {t(`cheatIntensity.${level}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
