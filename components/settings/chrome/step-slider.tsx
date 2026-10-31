'use client';

import type { ComponentProps } from 'react';

interface StepSliderProps
  extends Omit<
    ComponentProps<'input'>,
    'type' | 'min' | 'max' | 'step' | 'value' | 'onChange'
  > {
  min: number;
  max: number;
  step: number;
  /** A dot on the track at every multiple of this, from min to max. */
  tickEvery: number;
  value: number;
  onChange: (value: number) => void;
}

// The thumb's centre travels from half its width (8px) to the width minus
// that, so marks and fill are placed on the same inset scale.
const at = (fraction: number) => `calc(8px + (100% - 16px) * ${fraction})`;

/**
 * A native range input (for its keyboard and screen-reader support) over a
 * hand-drawn track: an accent fill up to the thumb and a dot at each tick.
 * Drawn by hand because Chrome paints the unfilled track near-black beside a
 * light accent colour.
 */
export function StepSlider({
  min,
  max,
  step,
  tickEvery,
  value,
  onChange,
  // aria-label/-valuetext, and the id/aria FormControl injects.
  ...rest
}: StepSliderProps) {
  const span = max - min;
  const ticks = Array.from(
    { length: Math.round(span / tickEvery) + 1 },
    (_, i) => (i * tickEvery) / span
  );

  return (
    <div className="relative h-4 min-w-0 flex-1">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-kallo-segment" />
      <div
        className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-kallo-accent"
        style={{ width: at((value - min) / span) }}
      />
      {ticks.map((f) => (
        <span
          key={f}
          aria-hidden="true"
          className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-kallo-text-muted/60"
          style={{ left: at(f) }}
        />
      ))}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        {...rest}
        className="absolute inset-0 h-full w-full appearance-none rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-kallo-border [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-kallo-border [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
      />
    </div>
  );
}
