'use client';

import { useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { getStreamingPhaseLabel } from '@/components/logging/feed/streaming/streaming-phase-label';
import type { StreamTickerFrame } from '@/lib/domain/logging/stream-ticker';

/**
 * How long one action verb holds before the line flips to the next.
 *
 * The flip itself eats 360ms of this (180 out, 180 in), so the verb is only
 * STILL for dwell − 360. At 1600 that left ~1.24s of settled reading and the
 * line felt hurried; 2400 gives just over two seconds, which also suits the
 * longer Vietnamese verbs.
 */
export const VERB_DWELL_MS = 2400;

/** What the ticker says right now, and how it should be voiced. */
export interface TickerLine {
  /** A new key is what makes the line flip. */
  key: string;
  text: string;
  detail?: string;
  /**
   * `dish` is the meal's own words (serif italic); `verb` is the app narrating
   * itself and takes the locale's shared opener; `plain` is already a whole
   * sentence and takes none.
   */
  kind: 'verb' | 'dish' | 'plain';
  /**
   * The word every verb in this locale opens with, held STILL while the rest of
   * the line flips — Vietnamese builds every verb as "Đang <verb>", and
   * re-animating that word on each rotation was wasted motion. Empty in
   * English, and empty for any line that is not a verb.
   */
  prefix: string;
}

/** The verbs for a stage, or an empty list when the locale carries none. */
function useStageVerbs() {
  const t = useTranslations('logging.streaming');
  return useCallback(
    (stage: string): string[] => {
      const key = `verbs.${stage}`;
      // A bad l10n edit must degrade to the stage's flat label, not print a
      // raw key path.
      if (!t.has(key)) return [];
      const raw = t.raw(key);
      return Array.isArray(raw)
        ? raw.filter((verb): verb is string => typeof verb === 'string')
        : [];
    },
    [t]
  );
}

/**
 * Turns a stream frame into the one line the ticker shows, rotating through the
 * current stage's action verbs and standing aside whenever a dish lands.
 *
 * Split from the component so the sequencing — which is all of the behaviour —
 * can be read and tested without a canvas or an AnimatePresence in the way.
 */
export function useTickerLine(frame: StreamTickerFrame | null): TickerLine {
  const t = useTranslations('logging.streaming');
  const verbsFor = useStageVerbs();
  const reduceMotion = useReducedMotion();

  const isDish = frame != null && frame.kind !== 'phase';
  const frameKey = frame?.key ?? null;
  const stage = frame?.stage ?? null;

  // `verb` is which verb of the current stage shows; `showingItem` is true for
  // the one dwell after a dish lands, while the line is showing that dish.
  const [rotation, setRotation] = useState({ verb: 0, showingItem: false });
  const [seen, setSeen] = useState({ frameKey, stage });

  // Adjusted during render rather than in an effect (React's own pattern for
  // "reset state when a prop changes"): an effect would paint the outgoing verb
  // for one frame first, and AnimatePresence would flip through it.
  if (seen.frameKey !== frameKey || seen.stage !== stage) {
    setSeen({ frameKey, stage });
    setRotation((current) => ({
      // A new stage restarts its own set rather than continuing the last one's
      // rotation, so every stage opens on its first, most literal verb.
      verb: seen.stage === stage ? current.verb : 0,
      // A dish just landed: interrupt whatever verb was showing and give it the
      // line — that is the only genuinely new information on screen. Under
      // reduced motion nothing hands the line back, so it settles on the dish.
      showingItem: isDish,
    }));
  }

  // Runs for the WHOLE run, not just while a verb shows: the same tick is what
  // hands the line back from a dish to the stage's verbs. Re-based on every
  // frame so a dish always gets a full dwell.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameKey re-bases the dwell, it is not read
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setRotation((current) =>
        current.showingItem
          ? { ...current, showingItem: false }
          : { verb: current.verb + 1, showingItem: false }
      );
    }, VERB_DWELL_MS);
    return () => clearInterval(id);
  }, [reduceMotion, frameKey]);

  if (rotation.showingItem && frame != null && frame.kind !== 'phase') {
    return {
      key: frame.key,
      text: frame.text,
      detail: frame.detail,
      kind: 'dish',
      prefix: '',
    };
  }
  // Nothing staged behind this frame (saving) — it is already a whole sentence,
  // so it takes no opener.
  if (stage == null) {
    return {
      key: frame?.key ?? 'idle',
      text: frame?.text ?? '',
      kind: 'plain',
      prefix: '',
    };
  }
  // Otherwise: the verb for whatever stage the pipeline is actually in — even
  // when `frame` is a dish, which is what makes the matching and estimating
  // verbs reachable at all.
  const verbs = verbsFor(stage);
  if (verbs.length === 0) {
    // The flat label is a whole sentence too, opener included.
    return {
      key: `phase-${stage}`,
      text: getStreamingPhaseLabel(t, stage),
      kind: 'plain',
      prefix: '',
    };
  }
  const index = rotation.verb % verbs.length;
  return {
    key: `phase-${stage}-${index}`,
    text: verbs[index],
    kind: 'verb',
    prefix: t.has('verbs.prefix') ? t('verbs.prefix') : '',
  };
}
