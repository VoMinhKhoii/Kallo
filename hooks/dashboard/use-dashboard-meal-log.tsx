'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStreamAnalysis } from '@/hooks/meals/analysis/use-stream-analysis';
import { pickLoaderIndex } from '@/lib/core/ui/loaders/registry';
import {
  deriveStreamTicker,
  type StreamTickerFrame,
} from '@/lib/domain/logging/stream-ticker';
import { useDashboardAutoSave } from './use-dashboard-autosave';

export interface DashboardMealStream {
  /** Analysis or save currently in flight — the bar shows the ticker. */
  isActive: boolean;
  /** The current ticker frame (loader stays, text flips per frame). */
  ticker: StreamTickerFrame | null;
  /** Index into STREAM_LOADERS — randomized per run, stable within it. */
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
      setLoaderIndex(pickLoaderIndex());
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
  // The bar shows ONE line that flips as the stream progresses. Saving outranks
  // everything — it is the only frame the shared derivation cannot see, since
  // the analysis stream is already finished by then.
  const ticker = useMemo<StreamTickerFrame | null>(() => {
    if (isSaving) {
      return { key: 'saving', kind: 'phase', text: t('saving'), stage: null };
    }
    return deriveStreamTicker(stream);
  }, [isSaving, stream, t]);

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
