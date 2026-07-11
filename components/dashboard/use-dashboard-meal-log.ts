'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getStreamingPhaseLabel } from '@/components/logging/feed/streaming/streaming-phase-label';
import { DASH_LOADERS } from '@/components/shared/svg-loaders';
import {
  useConfirmMeal,
  useDeleteMeal,
} from '@/hooks/meals/use-meal-mutations';
import { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';

/** One frame of the input-bar ticker; a new `key` flips the text in place. */
export interface StreamTickerFrame {
  key: string;
  text: string;
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
 * names, and resolved macros), then auto-saves. The confirm mutation's
 * optimistic cache write lands the meal in Recent meals and the hero number /
 * ring / macro bars animate on their own.
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
  const confirmMeal = useConfirmMeal(userId);
  const deleteMeal = useDeleteMeal();

  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loaderIndex, setLoaderIndex] = useState(0);
  const [ticker, setTicker] = useState<StreamTickerFrame | null>(null);
  // Bumped object identity tells the input to restore a dismissed draft.
  const [restoredDraft, setRestoredDraft] = useState<{ text: string } | null>(
    null
  );
  const submittedAtRef = useRef<Date | null>(null);
  const confirmedAnalysisRef = useRef<string | null>(null);

  const { analyze, reset } = stream;
  const { mutate: confirm } = confirmMeal;
  const { mutate: removeMeal } = deleteMeal;

  const submit = useCallback(
    (text: string) => {
      if (stream.isAnalyzing || isSaving) return;
      setSubmittedText(text);
      setRestoredDraft(null);
      setLoaderIndex(Math.floor(Math.random() * DASH_LOADERS.length));
      submittedAtRef.current = new Date();
      void analyze({
        message: text,
        loggedDate: todayDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        mode: 'precise',
      });
    },
    [analyze, isSaving, stream.isAnalyzing, todayDate]
  );

  const onRetry = useCallback(() => {
    if (!submittedText || stream.isAnalyzing) return;
    setLoaderIndex(Math.floor(Math.random() * DASH_LOADERS.length));
    submittedAtRef.current = new Date();
    void analyze({
      message: submittedText,
      loggedDate: todayDate,
      timezoneOffset: new Date().getTimezoneOffset(),
      mode: 'precise',
    });
  }, [analyze, stream.isAnalyzing, submittedText, todayDate]);

  const onDismiss = useCallback(() => {
    // Hand the text back to the input so a mistyped meal is one edit away.
    if (submittedText) setRestoredDraft({ text: submittedText });
    setSubmittedText(null);
    reset();
  }, [reset, submittedText]);

  // --- Ticker frames -------------------------------------------------------
  // The bar shows ONE line that flips as the stream progresses. Later effects
  // win over earlier ones within a render pass, so a resolved item beats the
  // name announcement it accompanies.

  // Pipeline stage (only before any item has been named, and again while
  // assembling — between those, item traffic carries the story).
  useEffect(() => {
    if (!stream.isAnalyzing) return;
    if (stream.items.length === 0 || stream.status === 'assembling') {
      setTicker({
        key: `phase-${stream.status}`,
        text: getStreamingPhaseLabel(ts, stream.status),
      });
    }
  }, [stream.isAnalyzing, stream.items.length, stream.status, ts]);

  // A newly named item.
  useEffect(() => {
    const name = stream.items.at(-1);
    if (!name) return;
    setTicker({ key: `name-${stream.items.length}`, text: `${name}…` });
  }, [stream.items]);

  // A resolved item — name + kcal.
  useEffect(() => {
    const item = stream.completedItems.at(-1);
    if (!item) return;
    setTicker({
      key: `done-${item.id}`,
      text: `${item.name} · ${Math.round(item.macros.calories)} kcal`,
    });
  }, [stream.completedItems]);

  // Saving.
  useEffect(() => {
    if (isSaving) {
      setTicker({ key: 'saving', text: t('saving') });
    }
  }, [isSaving, t]);

  // --- Auto-save -----------------------------------------------------------
  // The dashboard is quick capture — no confirm step. Undo (via the toast)
  // deletes the saved meal; full editing lives on /logging.
  useEffect(() => {
    if (stream.status !== 'done' || !stream.result || !stream.analysisId) {
      return;
    }
    if (confirmedAnalysisRef.current === stream.analysisId) return;
    confirmedAnalysisRef.current = stream.analysisId;

    const mealId = crypto.randomUUID();
    setIsSaving(true);
    confirm(
      {
        analysisId: stream.analysisId,
        mealId,
        originDate: todayDate,
        parsedMeal: stream.result,
        rawInput: submittedText ?? '',
        loggedAt: (submittedAtRef.current ?? new Date()).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(t('streaming.saved'), {
            action: {
              label: t('streaming.undo'),
              onClick: () => removeMeal({ mealId }),
            },
          });
        },
        onSettled: () => {
          setIsSaving(false);
          setSubmittedText(null);
          setTicker(null);
          reset();
        },
      }
    );
  }, [
    confirm,
    removeMeal,
    reset,
    stream.analysisId,
    stream.result,
    stream.status,
    submittedText,
    t,
    todayDate,
  ]);

  const streaming: DashboardMealStream = {
    isActive: stream.isAnalyzing || isSaving,
    ticker,
    loaderIndex,
    error: stream.status === 'error' ? stream.error : null,
    onRetry,
    onDismiss,
  };

  return { submit, streaming, restoredDraft };
}
