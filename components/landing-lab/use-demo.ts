'use client';

import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLabFixture,
  LAB_AUTOPLAY_ID,
  type LabDemoFixture,
} from './fixtures';

export type LabPhase = 'typing' | 'matching' | 'estimating' | 'result';

/**
 * The coarse state each variant's signature visual reacts to
 * (shader hue, 3D orbit, globe spin).
 */
export type LabMood = 'idle' | 'typing' | 'analyzing' | 'result';

const TYPING_SPEED_MS = 45;
const MATCH_MS = 700;
const ESTIMATE_MS = 800;

export interface LabDemo {
  fixture: LabDemoFixture;
  phase: LabPhase;
  mood: LabMood;
  typedText: string;
  /** True once the canned autoplay finishes and the bar becomes a real control. */
  interactive: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  selectChip: (id: string) => void;
  submitText: (text: string) => void;
  isAnalyzing: boolean;
  showResult: boolean;
  prefersReducedMotion: boolean;
}

/**
 * The playable derivation demo, lifted from the production hero
 * (components/landing-page/hero.tsx) so all four lab variants share one
 * state machine: type the meal, run the staged phases, reveal the card.
 * Reduced motion skips straight to the result with no typing or delays.
 */
export function useLabDemo(): LabDemo {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const [fixture, setFixture] = useState<LabDemoFixture>(() =>
    getLabFixture(LAB_AUTOPLAY_ID)
  );
  const [phase, setPhase] = useState<LabPhase>('typing');
  const [typedText, setTypedText] = useState('');
  const [interactive, setInteractive] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timers.current) {
      clearTimeout(id);
    }
    timers.current = [];
  }, []);

  const runDemo = useCallback(
    (next: LabDemoFixture, { autoplay }: { autoplay: boolean }) => {
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

  // Autoplay once on mount, deferred a tick so no state is set
  // synchronously inside the effect body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run exactly once
  useEffect(() => {
    const kickoff = setTimeout(
      () => runDemo(getLabFixture(LAB_AUTOPLAY_ID), { autoplay: true }),
      0
    );
    return () => {
      clearTimeout(kickoff);
      clearTimers();
    };
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
          chipLabel: trimmed,
          rows: fixture.rows,
          totalRange: fixture.totalRange,
        },
        { autoplay: false }
      );
    },
    [fixture.rows, fixture.totalRange, runDemo]
  );

  const selectChip = useCallback(
    (id: string) => {
      setInputValue('');
      runDemo(getLabFixture(id), { autoplay: false });
    },
    [runDemo]
  );

  const isAnalyzing = phase === 'matching' || phase === 'estimating';

  const mood: LabMood =
    phase === 'typing'
      ? 'typing'
      : isAnalyzing
        ? 'analyzing'
        : phase === 'result'
          ? 'result'
          : 'idle';

  return {
    fixture,
    phase,
    mood,
    typedText,
    interactive,
    inputValue,
    setInputValue,
    selectChip,
    submitText,
    isAnalyzing,
    showResult: phase === 'result',
    prefersReducedMotion,
  };
}
