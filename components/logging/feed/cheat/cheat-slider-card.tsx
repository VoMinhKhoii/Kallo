'use client';

import {
  Beer,
  Droplet,
  Drumstick,
  type LucideIcon,
  PartyPopper,
  Wheat,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { TurnHeader } from '@/components/logging/feed/turn-header';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  CHEAT_SLIDER_COLORS,
  defaultLevels,
  resolveSliderNutrition,
} from '@/lib/cheat/slider-nutrition';
import type {
  CheatSlider,
  CheatSliderLevels,
  CheatSliderSpec,
} from '@/lib/types/cheat';
import { cn } from '@/lib/utils';

// One food-domain icon per macro axis — encodes the slider's identity (and
// shares its accent color), replacing the decorative status dot.
const CHEAT_SLIDER_ICONS: Record<CheatSlider['key'], LucideIcon> = {
  protein: Drumstick,
  carbs: Wheat,
  fat: Droplet,
  drinks: Beer,
};

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

export function CheatSliderCard({
  spec,
  userInput,
  timestamp,
  isConfirming,
  onConfirm,
  onClarify,
}: CheatSliderCardProps) {
  const t = useTranslations('logging.cheatSliders');
  const locale = useLocale();
  const [levels, setLevels] = useState<CheatSliderLevels>(() =>
    defaultLevels(spec)
  );

  const resolved = useMemo(
    () => resolveSliderNutrition(spec, levels),
    [spec, levels]
  );

  const timeLabel = timestamp.toLocaleTimeString(locale, {
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
        className="relative"
      >
        <TurnHeader timeLabel={timeLabel} message={userInput} />
        <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
          {userInput && (
            <p className="mb-3 font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
              {userInput}
            </p>
          )}
          <p className="mb-3 font-sans-display text-nham-text text-sm">
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
                  className="rounded-full border border-nham-border/60 px-3 py-1.5 font-sans-display text-nham-text text-sm transition-colors hover:border-nham-accent/60 hover:bg-nham-hover/40 disabled:opacity-50"
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
      className="relative"
    >
      <TurnHeader timeLabel={timeLabel} message={userInput} />

      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          {userInput && (
            <p className="font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
              {userInput}
            </p>
          )}
          <Badge className="shrink-0 gap-1 border-transparent bg-nham-accent/15 font-sans-display text-nham-text">
            <PartyPopper className="h-3 w-3" />
            {t('badge')}
          </Badge>
        </div>

        {/* Live calorie + macro readout */}
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-sans-display">
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
      </div>

      {/* Save action sits below the card body, like a primary action under the
          meal rather than inside the card. */}
      <button
        type="button"
        disabled={isConfirming}
        aria-busy={isConfirming}
        onClick={() => onConfirm?.(levels)}
        className="mt-2 w-full rounded-xl bg-nham-btn py-2.5 font-medium font-sans-display text-sm text-white transition-colors hover:bg-nham-btn-hover disabled:opacity-50"
      >
        {t('confirm')}
      </button>
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
  const color = CHEAT_SLIDER_COLORS[slider.key];
  const Icon = CHEAT_SLIDER_ICONS[slider.key];
  const stops = [...slider.anchors].sort((a, b) => a.level - b.level);

  // Even levels sit on a labeled stop; odd levels (1/3/5/7/9) are the "between
  // two stops" positions, so we highlight the two bracketing stops instead.
  const onStop = level % 2 === 0;
  const betweenLow = onStop ? -1 : level - 1;
  const betweenHigh = onStop ? -1 : level + 1;

  const valueText = onStop
    ? (stops.find((s) => s.level === level)?.label ?? slider.label)
    : t('between', {
        low: stops.find((s) => s.level === betweenLow)?.label ?? '',
        high: stops.find((s) => s.level === betweenHigh)?.label ?? '',
      });

  // Stops alternate above / below the track (three each) so six labels fit
  // without crowding, each positioned at its point on the 0–10 scale.
  const renderStop = (
    anchor: (typeof stops)[number],
    side: 'top' | 'bottom'
  ) => {
    const isExact = onStop && anchor.level === level;
    const isBetween =
      anchor.level === betweenLow || anchor.level === betweenHigh;
    const isLeftEdge = anchor.level === 0;
    const isRightEdge = anchor.level === 10;

    return (
      <button
        key={anchor.level}
        type="button"
        aria-pressed={isExact}
        onClick={() => onChange(anchor.level)}
        className={cn(
          // Explicit width (not max-width): a label pinned at left:100% with
          // only max-width shrinks to the ~0 space left of the container edge
          // and collapses to one word per line. A fixed width wraps it at a real
          // 4–5-word column and shows the whole label.
          'absolute w-[5rem] cursor-pointer text-[11px] leading-tight transition-colors sm:w-[7.5rem]',
          side === 'top' ? 'bottom-0 pb-3' : 'top-0 pt-3',
          isLeftEdge ? 'text-left' : isRightEdge ? 'text-right' : 'text-center',
          isExact
            ? 'font-semibold text-nham-text'
            : isBetween
              ? 'text-nham-text'
              : 'text-nham-text-muted hover:text-nham-text'
        )}
        style={{
          left: `${anchor.level * 10}%`,
          transform: isLeftEdge
            ? 'translateX(0)'
            : isRightEdge
              ? 'translateX(-100%)'
              : 'translateX(-50%)',
        }}
      >
        {anchor.label}
      </button>
    );
  };

  return (
    <div className="font-sans-display">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon aria-hidden className="h-4 w-4 shrink-0" style={{ color }} />
        <span className="font-medium text-nham-text text-sm">
          {slider.label}
        </span>
      </div>
      <div className="relative">
        {/* Three scenarios above the track */}
        <div className="relative h-14">
          {stops.map((anchor, i) =>
            i % 2 === 0 ? renderStop(anchor, 'top') : null
          )}
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
        {/* Three scenarios below the track */}
        <div className="relative h-14">
          {stops.map((anchor, i) =>
            i % 2 === 1 ? renderStop(anchor, 'bottom') : null
          )}
        </div>
      </div>
    </div>
  );
}
