'use client';

import { type MotionValue, motion, useTransform } from 'motion/react';
import { memo } from 'react';
import type { GlobeCountry } from './globe-dishes';
import {
  arrangeStop,
  STORY_SCROLL,
  stopCenter,
  type TourStop,
} from './globe-tour';
import { type Ink, useInk } from './ink';

/**
 * One continent stop of the globe tour, pinned over the globe stage.
 * Each stop grows in, holds at a settled plateau (the "you have arrived"
 * beat), then dissolves into the next while the globe morphs underneath.
 *
 * Countries are open editorial annotations — flag, serif name, dish
 * lines set straight on the ground, no card chrome — tethered to their
 * country by the callout layer's straight elbow line (anchored at the
 * name row via `data-card-iso`). Columns are arranged west/east and
 * ordered north→south so the lines never cross.
 *
 * Ink follows the sky: the stage ground reflects each continent's real
 * day/night, so every text tone interpolates between its daylight and
 * night value off the shared `darkness` motion value.
 */

/** Inward nudges per annotation index — keeps the columns hand-set. */
const LEFT_OFFSETS = [0, 52, 18];
const RIGHT_OFFSETS = [44, 0, 60];

function CountryAnnotation({
  country,
  side,
  index,
  drift,
  ink,
  anchored,
}: {
  country: GlobeCountry;
  side: 'left' | 'right';
  index: number;
  drift: MotionValue<number>;
  ink: Ink;
  /** Only the desktop instances anchor leader lines. */
  anchored: boolean;
}) {
  // Deeper annotations trail the overlay's drift a touch more — a soft
  // parallax stagger instead of a block arriving as one.
  const y = useTransform(drift, (value) => value * (1 + index * 0.22));
  const alignEnd = side === 'right';

  return (
    <motion.div
      style={{ y }}
      className={`pointer-events-auto max-w-[19rem] ${
        alignEnd ? 'text-right' : 'text-left'
      }`}
    >
      {/* The name row is the line's anchor — the elbow lands beside it. */}
      <div
        data-card-iso={anchored ? country.iso : undefined}
        className={`flex w-fit items-center gap-2.5 ${
          alignEnd ? 'ml-auto flex-row-reverse' : ''
        }`}
      >
        <span aria-hidden className="text-[22px] leading-none">
          {country.flag}
        </span>
        <motion.p
          style={{ color: ink.strong }}
          className="font-normal font-serif text-xl leading-tight"
        >
          {country.name}
        </motion.p>
      </div>
      <motion.p
        style={{ color: ink.soft }}
        className="mt-1 font-sans-display text-xs italic"
      >
        {country.note}
      </motion.p>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {country.dishes.slice(0, 2).map((dish) => (
          <li
            key={dish.name}
            className="line-clamp-1 font-sans-display text-sm leading-snug"
          >
            <motion.span style={{ color: ink.strong }} className="font-medium">
              {dish.name}
            </motion.span>
            <motion.span style={{ color: ink.mid }}>
              {' '}
              · {dish.adjustments}
            </motion.span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export const TourStopOverlay = memo(function TourStopOverlay({
  stop,
  index,
  progress,
  darkness,
}: {
  stop: TourStop;
  index: number;
  progress: MotionValue<number>;
  darkness: MotionValue<number>;
}) {
  const { left, right } = arrangeStop(stop);

  // Trapezoid window: grow in through the shoulder, HOLD at a settled
  // plateau around the stop's center (the hard stop that makes each
  // continent legible), then dissolve into the next.
  const center = stopCenter(index);
  const half = 0.55 / STORY_SCROLL;
  const stopWindow = [
    center - half,
    center - half * 0.32,
    center + half * 0.32,
    center + half,
  ];
  const opacity = useTransform(progress, stopWindow, [0, 1, 1, 0]);
  const drift = useTransform(progress, stopWindow, [56, 0, 0, -44]);
  const scale = useTransform(progress, stopWindow, [0.93, 1, 1, 0.975]);
  // Faded-out overlays must not sit on top of the active one's content.
  const visibility = useTransform(opacity, (value) =>
    value < 0.02 ? ('hidden' as const) : ('visible' as const)
  );

  const ink = useInk(darkness);

  return (
    <motion.div
      data-tour-overlay
      style={{ opacity, visibility }}
      className="pointer-events-none absolute inset-0 flex flex-col px-6 py-16 lg:px-[4vw] lg:py-20"
    >
      <motion.div style={{ scale }} className="flex h-full flex-col">
        <motion.div
          style={{ y: drift }}
          className="pointer-events-auto self-center text-center"
        >
          <motion.p
            style={{ color: ink.eyebrow }}
            className="mb-2 font-semibold text-xs uppercase tracking-[0.24em]"
          >
            {stop.continent}
          </motion.p>
          <motion.h2
            style={{ color: ink.strong }}
            className="font-light font-serif text-2xl italic leading-[1.15] tracking-[-0.01em] sm:text-3xl"
          >
            {stop.tagline}
          </motion.h2>
        </motion.div>

        {/* Desktop: annotations flank the globe, hand-staggered. */}
        <div className="hidden flex-1 items-center justify-between gap-6 lg:flex">
          <div className="flex flex-col items-start gap-6">
            {left.map((country, i) => (
              <div
                key={country.iso}
                style={{ marginLeft: LEFT_OFFSETS[i] ?? 0 }}
              >
                <CountryAnnotation
                  country={country}
                  side="left"
                  index={i}
                  drift={drift}
                  ink={ink}
                  anchored
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-end gap-6">
            {right.map((country, i) => (
              <div
                key={country.iso}
                style={{ marginRight: RIGHT_OFFSETS[i] ?? 0 }}
              >
                <CountryAnnotation
                  country={country}
                  side="right"
                  index={i}
                  drift={drift}
                  ink={ink}
                  anchored
                />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: one scrollable column below the globe. */}
        <div className="mt-auto flex max-h-[46vh] flex-col gap-4 overflow-y-auto pt-8 lg:hidden">
          {[...left, ...right].map((country, i) => (
            <CountryAnnotation
              key={country.iso}
              country={country}
              side="left"
              index={i}
              drift={drift}
              ink={ink}
              anchored={false}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
});
