'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scrollToAnchorId } from '@/components/landing-page/scroll-to-anchor';
import { Button } from '@/components/ui/button';
import { CommandBar, DemoChips } from '../command-bar';
import { LAB_COPY } from '../copy';
import { DerivationCard } from '../derivation-card';
import { useLabDemo } from '../use-demo';
import { FallbackBlobs } from '../v1/shader-field';
import { CalloutLayer, type CalloutLayerHandle } from './callout-layer';
import { CountryPanel } from './country-panel';
import {
  makeDarknessCurve,
  STORY_SCROLL,
  TOUR_ISO_SETS,
  TOUR_STOPS,
  tourMarkers,
} from './globe-tour';
import { useInk } from './ink';
import { StageBackdrop } from './stage-backdrop';
import { TourStopOverlay } from './tour-cards';

const V3GlobeScene = dynamic(
  () => import('./globe-scene').then((module) => module.V3GlobeScene),
  { ssr: false, loading: () => <FallbackBlobs /> }
);

/**
 * The v3 hero is a scroll story over ONE pinned globe: at the top only
 * its horizon arc rises behind the centered copy; scrolling morphs the
 * sphere up into a full centered globe, then steers it continent by
 * continent while flag cards fan out on both sides, ending on a free
 * hover-to-explore stage. No section seams — the globe carries the
 * whole scroll.
 */
export function V3Hero() {
  const demo = useLabDemo();
  const storyRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ['start start', 'end end'],
  });
  const veilOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  // Warm space, keyed to the REAL clock: each continent's backdrop
  // reflects its current day/night — cream daylight, espresso night —
  // interpolated along the scroll exactly like the globe's facing, so
  // day fades to night with no hard transitions. The explore stage uses
  // the viewer's own local time.
  const darknessCurve = useMemo(() => makeDarknessCurve(new Date()), []);
  const darkness = useTransform(scrollYProgress, darknessCurve);
  const ink = useInk(darkness);
  // Skip the entrance slide for users who prefer reduced motion.
  const entrance = useReducedMotion() ? false : { opacity: 0, y: 16 };

  // Which screen the viewport is nearest: 0 = hero, 1..N = tour stops,
  // N+1 = free explore. The globe's facing and the card overlays follow
  // scroll continuously; this discrete stage only gates the country
  // highlight set and the final hover interactivity.
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = Math.min(
      STORY_SCROLL,
      Math.max(0, Math.round(value * STORY_SCROLL))
    );
    setStage(next);
  });

  const stopIndex = stage - 1;
  const activeStop =
    stopIndex >= 0 && stopIndex < TOUR_STOPS.length
      ? TOUR_STOPS[stopIndex]
      : null;
  const interactive = stage === STORY_SCROLL;

  // Leader lines: the scene projects the active stop's countries to
  // screen space each frame; the callout layer redraws imperatively.
  // Stable identities keep the memoized scene from re-rendering on the
  // demo's per-keystroke ticks.
  const calloutRef = useRef<CalloutLayerHandle>(null);
  const markers = useMemo(
    () => (activeStop ? tourMarkers(activeStop) : []),
    [activeStop]
  );
  const handleMarkersProject = useCallback(
    (points: Parameters<CalloutLayerHandle['update']>[0]) =>
      calloutRef.current?.update(points),
    []
  );
  useEffect(() => {
    if (!activeStop) {
      calloutRef.current?.update([]);
    }
  }, [activeStop]);

  const [activeIso, setActiveIso] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A null (cursor left the polygon) is debounced so the panel doesn't
  // flicker while the pointer crosses country borders; a fresh country
  // applies immediately and cancels any pending clear.
  const handleCountryChange = useCallback((iso: string | null) => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (iso === null) {
      clearTimer.current = setTimeout(() => setActiveIso(null), 250);
    } else {
      setActiveIso(iso);
    }
  }, []);

  useEffect(
    () => () => {
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
      }
    },
    []
  );

  return (
    <section ref={storyRef} className="relative bg-[#FEFBF6]">
      {/* The pinned stage: one globe serves both screens. Pointer events
          stay off until the sphere has arrived so hero CTAs never fight
          the canvas. */}
      <div
        className={`sticky top-0 h-screen overflow-hidden ${
          interactive ? '' : 'pointer-events-none'
        }`}
      >
        <StageBackdrop darkness={darkness} />
        <V3GlobeScene
          progress={scrollYProgress}
          interactive={interactive}
          mood={demo.mood}
          activeIso={activeIso}
          onCountryChange={handleCountryChange}
          highlightIsos={activeStop ? TOUR_ISO_SETS[stopIndex] : undefined}
          markers={markers}
          onMarkersProject={handleMarkersProject}
        />
        {/* Leader lines from the tour cards to their countries. */}
        <CalloutLayer ref={calloutRef} />
        {/* Cream veil keeps the hero copy on calm ground over the arc,
            then dissolves as the globe takes the stage. */}
        <motion.div
          aria-hidden
          style={{
            opacity: veilOpacity,
            background:
              'radial-gradient(ellipse 75% 55% at 50% 38%, rgba(254,251,246,0.92), rgba(254,251,246,0.4) 60%, transparent 85%)',
          }}
          className="pointer-events-none absolute inset-0"
        />
      </div>

      {/* Content flows over the pinned stage. The wrapper is pointer-
          transparent so hovers reach the globe through the empty space;
          each card/control re-enables its own events. */}
      <div className="pointer-events-none relative z-10 -mt-[100vh]">
        {/* Screen 1: the centered hero copy, unchanged. */}
        <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-28 pb-16 text-center">
          <div className="pointer-events-auto flex w-full flex-col items-center">
            <motion.div
              initial={entrance}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#E8D5B5] bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C9A87C]" />
              <span className="font-semibold text-[#8B7355] text-xs uppercase tracking-[0.2em]">
                {LAB_COPY.badge}
              </span>
            </motion.div>

            <h1 className="mb-6 font-normal font-serif text-5xl text-[#2C2416] leading-[1.08] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
              {LAB_COPY.title}
              <br />
              <span className="font-light text-[#A9834E] italic">
                {LAB_COPY.titleHighlight}
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-xl font-light font-sans-display text-[#6B5D4F] text-lg leading-relaxed">
              {LAB_COPY.subtitle}
            </p>

            <motion.div
              initial={entrance}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="w-full"
            >
              <CommandBar demo={demo} />
            </motion.div>

            <div className="mt-4 min-h-8">
              <DemoChips demo={demo} />
            </div>

            <div className="mt-6 w-full">
              <DerivationCard demo={demo} />
            </div>

            <motion.div
              initial={entrance}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-2 flex flex-col items-center gap-4 sm:flex-row"
            >
              <Button variant="hero-dark" size="hero" className="group">
                <span className="font-medium tracking-wide">
                  {LAB_COPY.cta}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                variant="hero-outline"
                size="hero"
                onClick={() => scrollToAnchorId('taste-the-world')}
              >
                {LAB_COPY.ctaSecondary}
              </Button>
            </motion.div>

            <p className="mt-10 font-medium text-[#8B7355] text-sm">
              {LAB_COPY.beta}
            </p>
          </div>
        </div>

        {/* The continent tour: a scroll runway one screen per stop, with
            a pinned layer inside where the stops crossfade into each
            other — no screen boundaries, the globe morphs underneath. */}
        <div
          id="taste-the-world"
          className="relative"
          style={{ height: `${TOUR_STOPS.length * 100}vh` }}
        >
          <div className="sticky top-0 h-screen">
            {TOUR_STOPS.map((stop, index) => (
              <TourStopOverlay
                key={stop.id}
                stop={stop}
                index={index}
                progress={scrollYProgress}
                darkness={darkness}
              />
            ))}
          </div>
        </div>

        {/* Final screen: the globe is yours — hover any country, the
            dish panel follows. */}
        <div className="relative flex min-h-screen flex-col items-center px-6 py-20 lg:py-24">
          <div className="pointer-events-auto text-center">
            <motion.p
              style={{ color: ink.eyebrow }}
              className="mb-3 font-semibold text-xs uppercase tracking-[0.2em]"
            >
              {LAB_COPY.globe.eyebrow}
            </motion.p>
            <motion.h2
              style={{ color: ink.strong }}
              className="font-normal font-serif text-3xl leading-[1.1] tracking-[-0.02em] sm:text-4xl"
            >
              {LAB_COPY.globe.title}{' '}
              <motion.span
                style={{ color: ink.accent }}
                className="font-light italic"
              >
                {LAB_COPY.globe.titleHighlight}
              </motion.span>
            </motion.h2>
          </div>
          <div className="pointer-events-auto mt-auto w-full max-w-md lg:absolute lg:top-1/2 lg:right-[5vw] lg:mt-0 lg:w-[24rem] lg:-translate-y-1/2">
            <CountryPanel iso={activeIso} />
          </div>
        </div>
      </div>
    </section>
  );
}
