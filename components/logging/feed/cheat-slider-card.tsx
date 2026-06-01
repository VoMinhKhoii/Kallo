'use client';

import { PartyPopper } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  defaultLevels,
  resolveSliderNutrition,
} from '@/lib/cheat/slider-nutrition';
import type {
  CheatSlider,
  CheatSliderLevels,
  CheatSliderSpec,
} from '@/lib/types/cheat';
import { cn } from '@/lib/utils';

interface CheatSliderCardProps {
  spec: CheatSliderSpec;
  userInput?: string;
  timestamp: Date;
  isConfirming?: boolean;
  /** Confirm with the chosen slider levels. */
  onConfirm?: (levels: CheatSliderLevels) => void;
  /** Answer a clarifying question (rare vague-input fallback). */
  onClarify?: (answer: string) => void;
}

const MACRO_DOT: Record<string, string> = {
  protein: 'var(--color-nham-macro-protein)',
  carbs: 'var(--color-nham-macro-carbs)',
  fat: 'var(--color-nham-macro-fat)',
  drinks: 'var(--color-nham-accent)',
};

export function CheatSliderCard({
  spec,
  userInput,
  timestamp,
  isConfirming,
  onConfirm,
  onClarify,
}: CheatSliderCardProps) {
  const t = useTranslations('logging.cheatSliders');
  const [levels, setLevels] = useState<CheatSliderLevels>(() =>
    defaultLevels(spec)
  );

  const resolved = useMemo(
    () => resolveSliderNutrition(spec, levels),
    [spec, levels]
  );

  const timeLabel = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Vague-input fallback: a single clarifying question instead of sliders.
  if (spec.clarifyingQuestion) {
    const q = spec.clarifyingQuestion;
    return (
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="group relative"
      >
        <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
        <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-accent bg-white" />
        <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
          {userInput && (
            <p
              className="mb-3 text-[17px] text-nham-text leading-relaxed sm:text-[19px]"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {userInput}
            </p>
          )}
          <p
            className="mb-3 text-nham-text text-sm"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {q.prompt}
          </p>
          {q.options && q.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isConfirming}
                  aria-busy={isConfirming}
                  onClick={() => onClarify?.(option)}
                  className="rounded-full border border-nham-border/60 px-3 py-1.5 text-nham-text text-sm transition-colors hover:border-nham-accent/60 hover:bg-nham-hover/40 disabled:opacity-50"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
      <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-accent bg-white" />

      <div className="mb-2">
        <span
          className="font-bold text-[11px] text-nham-text-muted/60 tracking-widest"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {timeLabel}
        </span>
      </div>

      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          {userInput && (
            <p
              className="text-[17px] text-nham-text leading-relaxed sm:text-[19px]"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {userInput}
            </p>
          )}
          <Badge
            className="shrink-0 gap-1 border-transparent bg-nham-accent/15 text-nham-text"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <PartyPopper className="h-3 w-3" />
            {t('badge')}
          </Badge>
        </div>

        {spec.rationale && (
          <p
            className="mb-4 text-nham-text-muted text-sm leading-relaxed"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {spec.rationale}
          </p>
        )}

        {/* Live calorie + macro readout */}
        <div
          className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <span className="font-semibold text-2xl text-nham-text">
            ≈ {resolved.caloriesKcal} {t('kcal')}
          </span>
          <span className="text-nham-text-muted text-sm">
            P {Math.round(resolved.proteinG)}g · C{' '}
            {Math.round(resolved.carbohydrateG)}g · F{' '}
            {Math.round(resolved.fatG)}g
            {resolved.alcoholG > 0
              ? ` · ${t('alcohol')} ${Math.round(resolved.alcoholG)}g`
              : ''}
          </span>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-5">
          {spec.sliders.map((slider) => (
            <CheatSliderRow
              key={slider.key}
              slider={slider}
              level={levels[slider.key] ?? slider.defaultLevel}
              onChange={(level) =>
                setLevels((prev) => ({ ...prev, [slider.key]: level }))
              }
            />
          ))}
        </div>

        <button
          type="button"
          disabled={isConfirming}
          aria-busy={isConfirming}
          onClick={() => onConfirm?.(levels)}
          className="mt-5 w-full rounded-xl bg-nham-btn py-2.5 font-medium text-sm text-white transition-colors hover:bg-nham-btn-hover disabled:opacity-50"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('confirm')}
        </button>
      </div>
    </motion.article>
  );
}

function CheatSliderRow({
  slider,
  level,
  onChange,
}: {
  slider: CheatSlider;
  level: number;
  onChange: (level: number) => void;
}) {
  const t = useTranslations('logging.cheatSliders');
  const color = MACRO_DOT[slider.key];
  const stops = [...slider.anchors].sort((a, b) => a.level - b.level);

  // Even levels sit on a labeled stop; odd levels (1/3/5/7/9) are the "between
  // two stops" positions, so we highlight the two bracketing rows instead.
  const onStop = level % 2 === 0;
  const betweenLow = onStop ? -1 : level - 1;
  const betweenHigh = onStop ? -1 : level + 1;

  const valueText = onStop
    ? (stops.find((s) => s.level === level)?.label ?? slider.label)
    : t('between', {
        low: stops.find((s) => s.level === betweenLow)?.label ?? '',
        high: stops.find((s) => s.level === betweenHigh)?.label ?? '',
      });

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span
          className="font-medium text-nham-text text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {slider.label}
        </span>
      </div>
      <Slider
        min={0}
        max={10}
        step={1}
        value={[level]}
        onValueChange={(values) => onChange(values[0] ?? 0)}
        aria-label={slider.label}
        aria-valuetext={valueText}
      />
      {/* All six scenarios, always visible — tap one to jump there. */}
      <div
        className="mt-2 flex flex-col gap-0.5"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {stops.map((anchor) => {
          const isExact = onStop && anchor.level === level;
          const isBetween =
            anchor.level === betweenLow || anchor.level === betweenHigh;
          return (
            <button
              key={anchor.level}
              type="button"
              aria-pressed={isExact}
              onClick={() => onChange(anchor.level)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                isExact
                  ? 'bg-nham-hover/60 font-medium text-nham-text'
                  : isBetween
                    ? 'bg-nham-hover/30 text-nham-text'
                    : 'text-nham-text-muted hover:bg-nham-hover/40'
              )}
              style={
                isExact ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined
              }
            >
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  !(isExact || isBetween) && 'border border-nham-border'
                )}
                style={
                  isExact || isBetween ? { backgroundColor: color } : undefined
                }
              />
              <span>{anchor.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
