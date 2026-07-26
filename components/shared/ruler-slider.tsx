'use client';

import { animate } from 'motion/react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { useEffect, useRef } from 'react';

interface RulerAnchor {
  value: number;
  label: string;
}

interface RulerSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  anchors: RulerAnchor[];
  /** Distance (in value units) within which a release settles onto an anchor. */
  snapRadius?: number;
  ariaLabel: string;
}

// Minor ticks every 2.5% of the track width — a fine ruler grain that reads as
// continuous without crowding the taller labeled anchor ticks.
const MINOR_TICKS = Array.from({ length: 41 }, (_, i) => i * 2.5);

/**
 * A ruler-style slider (iOS goal-adjust feel): a continuous value with magnetic
 * anchors. Radix Slider drives the interaction; a tick strip and absolutely
 * positioned anchor labels give it the ruler grain, and releasing near an anchor
 * settles onto it with a motion spring.
 */
export function RulerSlider({
  min,
  max,
  value,
  onChange,
  anchors,
  snapRadius,
  ariaLabel,
}: RulerSliderProps) {
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const range = max - min;
  const radius = snapRadius ?? range * 0.06;

  const pct = (v: number) => (range > 0 ? ((v - min) / range) * 100 : 0);

  const nearestAnchor = (v: number): RulerAnchor | undefined =>
    anchors.reduce<RulerAnchor | undefined>(
      (best, a) =>
        best && Math.abs(best.value - v) <= Math.abs(a.value - v) ? best : a,
      undefined
    );

  useEffect(() => () => animRef.current?.stop(), []);

  const handleChange = (values: number[]) => {
    animRef.current?.stop();
    onChange(values[0] ?? min);
  };

  // On release, if we let go within snapRadius of an anchor, spring onto it.
  const handleCommit = (values: number[]) => {
    const v = values[0] ?? min;
    const target = nearestAnchor(v);
    if (target && target.value !== v && Math.abs(target.value - v) <= radius) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onChange(target.value);
        return;
      }
      animRef.current = animate(v, target.value, {
        type: 'spring',
        stiffness: 500,
        damping: 34,
        onUpdate: (n) => onChange(Math.round(n)),
      });
    }
  };

  return (
    <div className="font-sans-display">
      {/* Labeled anchor stops, pinned above their tick */}
      <div className="relative mb-1.5 h-4">
        {anchors.map((a) => (
          <span
            key={a.value}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-nham-text-muted"
            style={{ left: `${pct(a.value)}%` }}
          >
            {a.label}
          </span>
        ))}
      </div>

      <SliderPrimitive.Root
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={handleChange}
        onValueCommit={handleCommit}
        aria-label={ariaLabel}
        className="relative flex h-10 w-full touch-none select-none items-center"
      >
        {/* Tick strip: minor grain + taller major ticks at each anchor */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-6"
        >
          {MINOR_TICKS.map((p) => (
            <span
              key={`minor-${p}`}
              className="absolute bottom-0 h-2 w-px bg-nham-border"
              style={{ left: `${p}%` }}
            />
          ))}
          {anchors.map((a) => (
            <span
              key={`major-${a.value}`}
              className="absolute bottom-0 h-4 w-px -translate-x-1/2 bg-nham-border"
              style={{ left: `${pct(a.value)}%` }}
            />
          ))}
        </div>

        <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-nham-border/50">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-nham-accent/30" />
        </SliderPrimitive.Track>

        {/* Thumb doubles as the current-value indicator line */}
        <SliderPrimitive.Thumb
          aria-valuetext={`${value} g — ${nearestAnchor(value)?.label ?? ''}`}
          className="flex h-10 w-6 items-center justify-center rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-nham-accent/50"
        >
          <span className="h-8 w-0.5 rounded-full bg-nham-accent" />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>
    </div>
  );
}
