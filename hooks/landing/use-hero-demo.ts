'use client';

import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getHeroFixture,
  HERO_AUTOPLAY_ID,
  type HeroDemoFixture,
} from '@/components/landing-page/hero/hero-demo-fixtures';

/**
 * The staged "type → match → estimate → result" demo that plays inside the
 * landing hero's phone mock.
 *
 * Extracted from the hero component so the markup stays presentational: the
 * timers, the phase machine and the reduced-motion shortcut are all state, and
 * they were the bulk of what pushed hero.tsx past the size gate.
 */

export type DemoPhase = 'typing' | 'matching' | 'estimating' | 'result';

const TYPING_SPEED_MS = 45;
const MATCH_MS = 700;
const ESTIMATE_MS = 800;

export interface HeroDemo {
  fixture: HeroDemoFixture;
  phase: DemoPhase;
  /** The meal text as it has been typed out so far. */
  typedText: string;
  /** True once the canned demo finished and the input bar becomes real. */
  interactive: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  /** True while the staged analysis is running (input stays disabled). */
  isAnalyzing: boolean;
  showResult: boolean;
  /** Run a custom meal string the visitor typed. */
  submitText: (text: string) => void;
  /** Run one of the preset chips. */
  selectChip: (id: string) => void;
}

export function useHeroDemo(): HeroDemo {
  const prefersReducedMotion = useReducedMotion();

  // The meal currently being demonstrated (autoplay starts on the canned one).
  const [fixture, setFixture] = useState<HeroDemoFixture>(() =>
    getHeroFixture(HERO_AUTOPLAY_ID)
  );
  const [phase, setPhase] = useState<DemoPhase>('typing');
  const [typedText, setTypedText] = useState('');
  // Once the canned demo finishes, the input bar becomes a real control.
  const [interactive, setInteractive] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timers.current) {
      clearTimeout(id);
    }
    timers.current = [];
  }, []);

  // Drive one analysis: type the meal, run the staged phases, reveal the card.
  // Reduced motion skips straight to the result with no typing or delays.
  const runDemo = useCallback(
    (next: HeroDemoFixture, { autoplay }: { autoplay: boolean }) => {
      clearTimers();
      setFixture(next);

      if (prefersReducedMotion) {
        setTypedText(next.text);
        setPhase('result');
        if (autoplay) {
          setInteractive(true);
        }
        return;
      }

      setTypedText('');
      setPhase('typing');

      let index = 0;
      const typeNext = () => {
        index += 1;
        setTypedText(next.text.slice(0, index));
        if (index < next.text.length) {
          timers.current.push(setTimeout(typeNext, TYPING_SPEED_MS));
        } else {
          timers.current.push(
            setTimeout(() => setPhase('matching'), 300),
            setTimeout(() => setPhase('estimating'), 300 + MATCH_MS),
            setTimeout(
              () => {
                setPhase('result');
                if (autoplay) {
                  setInteractive(true);
                }
              },
              300 + MATCH_MS + ESTIMATE_MS
            )
          );
        }
      };
      timers.current.push(setTimeout(typeNext, 400));
    },
    [clearTimers, prefersReducedMotion]
  );

  // Autoplay once on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run exactly once
  useEffect(() => {
    runDemo(getHeroFixture(HERO_AUTOPLAY_ID), { autoplay: true });
    return clearTimers;
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      setInputValue('');
      runDemo(
        {
          id: 'custom',
          text: trimmed,
          rows: fixture.rows,
          total: fixture.total,
        },
        { autoplay: false }
      );
    },
    [fixture.rows, fixture.total, runDemo]
  );

  const selectChip = useCallback(
    (id: string) => {
      setInputValue('');
      runDemo(getHeroFixture(id), { autoplay: false });
    },
    [runDemo]
  );

  return {
    fixture,
    phase,
    typedText,
    interactive,
    inputValue,
    setInputValue,
    isAnalyzing: phase === 'matching' || phase === 'estimating',
    showResult: phase === 'result',
    submitText,
    selectChip,
  };
}
