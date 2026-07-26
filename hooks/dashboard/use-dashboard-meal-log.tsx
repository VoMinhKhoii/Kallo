'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStreamingPhaseLabel } from '@/components/logging/feed/streaming/streaming-phase-label';
import { DASH_LOADERS } from '@/components/shared/svg-loaders';
import { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';
import { useDashboardAutoSave } from './use-dashboard-autosave';

/** One frame of the input-bar ticker; a new `key` flips the text in place.
 *  `phase` frames are quiet sans labels; `item`/`macros` frames carry the
 *  meal's own words (serif italic), with `detail` as the resolved kcal. */
export interface StreamTickerFrame {
  key: string;
  kind: 'phase' | 'item' | 'macros';
  text: string;
  detail?: string;
}

export interface DashboardMealStream {
  /** Analysis or save currently in flight — the bar shows the ticker. */
  isActive: boolean;
  /** The current ticker frame (loader stays, text flips per frame). */
  ticker: StreamTickerFrame | null;
  /** Index into DASH_LOADERS — randomized per run, stable within it. */
  loaderIndex: number;
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Dashboard-native meal logging: the input bar itself streams the AI analysis
 * (a random SVG loader for the run + a ticker flipping through stages, item
 * names, and resolved macros), then auto-saves (see useDashboardAutoSave). The
 * confirm mutation's optimistic cache write lands the meal in Recent meals and
 * the hero number / ring / macro bars animate on their own.
 */
export function useDashboardMealLog({
  userId,
  todayDate,
}: {
  userId: string;
  todayDate: string;
}) {
  const t = useTranslations('dashboard');
  const ts = useTranslations('logging.streaming');
  const stream = useStreamAnalysis();

  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [loaderIndex, setLoaderIndex] = useState(0);
  // Bumped object identity tells the input to restore a dismissed draft.
  const [restoredDraft, setRestoredDraft] = useState<{ text: string } | null>(
    null
  );
  const submittedAtRef = useRef<Date | null>(null);
  // Stable id for the current attempt. A retry reuses it so, if the first try
  // errored client-side AFTER the server persisted its staging row (e.g. the
  // watchdog fired between the insert and analysis_complete), the retry upserts
  // that same row instead of orphaning it.
  const attemptIdRef = useRef<string | null>(null);

  const { analyze, reset } = stream;

  // Clearing on a settled save (and on dismiss) resets the attempt so the next
  // submit mints a fresh id; an ERROR leaves both intact so onRetry reuses them.
  const clearSubmitted = useCallback(() => {
    setSubmittedText(null);
    attemptIdRef.current = null;
  }, []);
  const isSaving = useDashboardAutoSave({
    userId,
    stream,
    todayDate,
    submittedText,
    submittedAtRef,
    onSaved: clearSubmitted,
  });

  const submit = useCallback(
    (text: string, options?: { retry?: boolean }) => {
      if (stream.isAnalyzing || isSaving) return;
      setSubmittedText(text);
      setRestoredDraft(null);
      setLoaderIndex(Math.floor(Math.random() * DASH_LOADERS.length));
      submittedAtRef.current = new Date();
      // Fresh submit starts a new attempt; a retry reuses the prior id so it
      // supersedes any row the first try already persisted rather than orphaning it.
      if (!options?.retry || !attemptIdRef.current) {
        attemptIdRef.current = crypto.randomUUID();
      }
      void analyze({
        message: text,
        loggedDate: todayDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        mode: 'precise',
        attemptId: attemptIdRef.current,
      });
    },
    [analyze, isSaving, stream.isAnalyzing, todayDate]
  );

  const onRetry = useCallback(() => {
    if (submittedText) submit(submittedText, { retry: true });
  }, [submit, submittedText]);

  const onDismiss = useCallback(() => {
    // Hand the text back to the input so a mistyped meal is one edit away.
    if (submittedText) setRestoredDraft({ text: submittedText });
    setSubmittedText(null);
    attemptIdRef.current = null;
    reset();
  }, [reset, submittedText]);

  // --- Ticker --------------------------------------------------------------
  // The bar shows ONE line that flips as the stream progresses. The frame is
  // derived, not accumulated: the pipeline emits names (decomposing) before
  // macros (estimating), so precedence is saving > assembling label > latest
  // resolved item > latest named item > stage label.
  const ticker = useMemo<StreamTickerFrame | null>(() => {
    if (isSaving) {
      return { key: 'saving', kind: 'phase', text: t('saving') };
    }
    if (!stream.isAnalyzing) return null;
    if (stream.status !== 'assembling') {
      const done = stream.completedItems.at(-1);
      if (done) {
        return {
          key: `done-${done.id}`,
          kind: 'macros',
          text: done.name,
          detail: `${Math.round(done.macros.calories)} kcal`,
        };
      }
      const name = stream.items.at(-1);
      if (name) {
        return {
          key: `name-${stream.items.length}`,
          kind: 'item',
          text: `${name}…`,
        };
      }
    }
    return {
      key: `phase-${stream.status}`,
      kind: 'phase',
      text: getStreamingPhaseLabel(ts, stream.status),
    };
  }, [
    isSaving,
    stream.completedItems,
    stream.isAnalyzing,
    stream.items,
    stream.status,
    t,
    ts,
  ]);

  // Step the sidebar back with the dimmed sections while a run is live (the
  // sidebar lives outside the dashboard tree, so it's flagged via <body>;
  // see globals.css `body[data-meal-streaming]`).
  const isActive = stream.isAnalyzing || isSaving;
  useEffect(() => {
    if (isActive) {
      document.body.setAttribute('data-meal-streaming', '');
    } else {
      document.body.removeAttribute('data-meal-streaming');
    }
    return () => document.body.removeAttribute('data-meal-streaming');
  }, [isActive]);

  const streaming: DashboardMealStream = {
    isActive,
    ticker,
    loaderIndex,
    error: stream.status === 'error' ? stream.error : null,
    onRetry,
    onDismiss,
  };

  return { submit, streaming, restoredDraft };
}
