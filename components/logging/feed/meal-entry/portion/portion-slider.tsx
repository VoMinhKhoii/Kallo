'use client';

import { Slider as SliderPrimitive } from 'radix-ui';

interface PortionSliderProps {
  grams: number;
  min: number;
  max: number;
  ariaLabel: string;
  ariaValueText: string;
  onChange: (grams: number) => void;
}

/** The container fine-adjustment track: a plain gram slider, no anchor ticks. */
export function PortionSlider({
  grams,
  min,
  max,
  ariaLabel,
  ariaValueText,
  onChange,
}: PortionSliderProps) {
  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={1}
      value={[grams]}
      onValueChange={(values) => onChange(values[0] ?? min)}
      aria-label={ariaLabel}
      className="relative flex h-4 w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-kallo-border/50">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-kallo-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-valuetext={ariaValueText}
        className="block size-4 shrink-0 rounded-full border border-kallo-accent bg-kallo-surface shadow-sm outline-hidden transition-[box-shadow] hover:ring-4 hover:ring-kallo-accent/20 focus-visible:ring-4 focus-visible:ring-kallo-accent/30"
      />
    </SliderPrimitive.Root>
  );
}
